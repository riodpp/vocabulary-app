use crate::models::*;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey, errors::Error as JwtError};
use lettre::{transport::smtp::authentication::Credentials, Message, SmtpTransport, Transport};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i32, // user id
    pub email: String,
    pub exp: usize,
}

pub struct AuthService {
    pool: PgPool,
    jwt_secret: String,
    smtp_transport: SmtpTransport,
}

impl AuthService {
    pub fn new(pool: PgPool) -> Result<Self, Box<dyn std::error::Error>> {
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key".to_string());

        // Set up SMTP transport for email sending
        let smtp_username = env::var("SMTP_USERNAME").unwrap_or_default();
        let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_default();
        let smtp_server = env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.mailgun.org".to_string());
        let smtp_port: u16 = env::var("SMTP_PORT")
            .unwrap_or_else(|_| "465".to_string())  // Use 465 for SSL
            .parse()
            .unwrap_or(465);

        println!("SMTP Configuration:");
        println!("  Server: {}", smtp_server);
        println!("  Port: {}", smtp_port);
        println!("  Username: {}", smtp_username);
        println!("  Password: {}", if smtp_password.is_empty() { "NOT SET" } else { "SET" });

        let creds = Credentials::new(smtp_username, smtp_password);
        let smtp_transport = SmtpTransport::relay(&smtp_server)?
            .port(smtp_port)
            .credentials(creds)
            .timeout(Some(std::time::Duration::from_secs(10)))
            .build();

        Ok(Self {
            pool,
            jwt_secret,
            smtp_transport,
        })
    }

    pub async fn register_user(&self, req: RegisterRequest) -> Result<User, Box<dyn std::error::Error>> {
        // Validate input
        req.validate()?;

        // Check if user already exists
        let existing_user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1"
        )
        .bind(&req.email)
        .fetch_optional(&self.pool)
        .await?;

        if existing_user.is_some() {
            return Err("User already exists".into());
        }

        // Hash password
        let password_hash = hash(&req.password, DEFAULT_COST)?;

        // Generate verification code
        let verification_code = self.generate_verification_code();
        let expires_at = Utc::now() + Duration::hours(24);

        // Create user
        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (email, password_hash, first_name, last_name, verification_code, verification_code_expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *"
        )
        .bind(&req.email)
        .bind(&password_hash)
        .bind(&req.first_name)
        .bind(&req.last_name)
        .bind(&verification_code)
        .bind(&expires_at)
        .fetch_one(&self.pool)
        .await?;

        // Try to send verification email (don't fail registration if email fails)
        match self.send_verification_email(&user.email, &verification_code).await {
            Ok(_) => println!("Verification email sent to {}", user.email),
            Err(e) => {
                println!("Failed to send verification email: {}. User registered but email not sent.", e);
                // Don't return error - user is still registered
            }
        }

        Ok(user)
    }

    pub async fn verify_email(&self, req: VerifyEmailRequest) -> Result<User, Box<dyn std::error::Error>> {
        req.validate()?;

        let mut user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1 AND verification_code = $2"
        )
        .bind(&req.email)
        .bind(&req.verification_code)
        .fetch_optional(&self.pool)
        .await?
        .ok_or("Invalid verification code")?;

        // Check if code is expired
        if let Some(expires_at) = user.verification_code_expires_at {
            if Utc::now() > expires_at {
                return Err("Verification code has expired".into());
            }
        }

        // Update user as verified
        user = sqlx::query_as::<_, User>(
            "UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires_at = NULL
             WHERE id = $1 RETURNING *"
        )
        .bind(user.id)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn login_user(&self, req: LoginRequest) -> Result<AuthResponse, Box<dyn std::error::Error>> {
        req.validate()?;

        // Find user
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1"
        )
        .bind(&req.email)
        .fetch_optional(&self.pool)
        .await?
        .ok_or("Invalid credentials")?;

        // Check if user is verified
        if !user.is_verified {
            return Err("Please verify your email before logging in".into());
        }

        // Verify password
        if !verify(&req.password, &user.password_hash)? {
            return Err("Invalid credentials".into());
        }

        // Get user's subscription
        let subscription = sqlx::query_as::<_, Subscription>(
            "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1"
        )
        .bind(user.id)
        .fetch_optional(&self.pool)
        .await?;

        // Generate JWT token
        let token = self.generate_jwt_token(&user)?;

        // Create session
        let expires_at = Utc::now() + Duration::days(7);
        sqlx::query(
            "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)"
        )
        .bind(user.id)
        .bind(&token)
        .bind(&expires_at)
        .execute(&self.pool)
        .await?;

        let user_response = UserResponse {
            id: user.id,
            email: user.email.clone(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            is_verified: user.is_verified,
            subscription: subscription.map(|s| SubscriptionResponse {
                plan_type: s.plan_type,
                status: s.status,
                current_period_end: s.current_period_end,
            }),
        };

        Ok(AuthResponse {
            user: user_response,
            token,
            expires_at,
        })
    }

    pub async fn validate_token(&self, token: &str) -> Result<User, Box<dyn std::error::Error>> {
        // First check if session exists and is not expired
        let _session = sqlx::query_as::<_, UserSession>(
            "SELECT * FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()"
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await?
        .ok_or("Invalid or expired session")?;

        // Decode JWT to get user info
        let claims = self.decode_jwt_token(token)?;

        // Get user details
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(claims.sub)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn logout_user(&self, token: &str) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query(
            "DELETE FROM user_sessions WHERE session_token = $1"
        )
        .bind(token)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    fn generate_jwt_token(&self, user: &User) -> Result<String, JwtError> {
        let expiration = Utc::now()
            .checked_add_signed(Duration::days(7))
            .expect("valid timestamp")
            .timestamp() as usize;

        let claims = Claims {
            sub: user.id,
            email: user.email.clone(),
            exp: expiration,
        };

        let header = Header::new(Algorithm::HS256);
        let encoding_key = EncodingKey::from_secret(self.jwt_secret.as_ref());

        encode(&header, &claims, &encoding_key)
    }

    fn decode_jwt_token(&self, token: &str) -> Result<Claims, JwtError> {
        let decoding_key = DecodingKey::from_secret(self.jwt_secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);

        let token_data = decode::<Claims>(token, &decoding_key, &validation)?;
        Ok(token_data.claims)
    }

    fn generate_verification_code(&self) -> String {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(0..1000000))
    }

    async fn send_verification_email(&self, email: &str, code: &str) -> Result<(), Box<dyn std::error::Error>> {
        println!("Attempting to send verification email to: {}", email);

        let email_body = format!(
            "Welcome to Vocabulary App!\n\nYour verification code is: {}\n\nThis code will expire in 24 hours.\n\nIf you didn't request this, please ignore this email.",
            code
        );

        let from_email = env::var("SMTP_FROM_EMAIL").unwrap_or_else(|_| "noreply@vocabularyapp.com".to_string());
        println!("Sending from: {}", from_email);

        let email = Message::builder()
            .from(from_email.parse()?)
            .to(email.parse()?)
            .subject("Verify your email - Vocabulary App")
            .body(email_body)?;

        println!("Connecting to SMTP server...");
        match self.smtp_transport.send(&email) {
            Ok(_) => {
                println!("✅ Email sent successfully to: {}", email);
                Ok(())
            }
            Err(e) => {
                println!("❌ Failed to send email to {}: {}", email, e);
                Err(Box::new(e))
            }
        }
    }
}