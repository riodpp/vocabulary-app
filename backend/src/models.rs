use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i32,
    pub email: String,
    pub password_hash: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub is_verified: bool,
    pub verification_code: Option<String>,
    pub verification_code_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserSession {
    pub id: i32,
    pub user_id: i32,
    pub session_token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Subscription {
    pub id: i32,
    pub user_id: i32,
    pub plan_type: String,
    pub status: String,
    pub stripe_customer_id: Option<String>,
    pub stripe_subscription_id: Option<String>,
    pub current_period_start: Option<DateTime<Utc>>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Request/Response DTOs
#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct VerifyEmailRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(equal = 6))]
    pub verification_code: String,
}


#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(message: String, data: T) -> Self {
        Self {
            success: true,
            message,
            data: Some(data),
        }
    }

    pub fn error(message: String) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            message,
            data: None,
        }
    }
}