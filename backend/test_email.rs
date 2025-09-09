use lettre::{transport::smtp::authentication::Credentials, Message, SmtpTransport, Transport};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenv::dotenv().ok();

    // Get SMTP configuration
    let smtp_username = env::var("SMTP_USERNAME").unwrap_or_default();
    let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_default();
    let smtp_server = env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.mailgun.org".to_string());
    let smtp_port: u16 = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())  // Use 465 for SSL
        .parse()
        .unwrap_or(465);
    let from_email = env::var("SMTP_FROM_EMAIL").unwrap_or_else(|_| "noreply@vocabularyapp.com".to_string());

    println!("🧪 Testing Email Configuration:");
    println!("  Server: {}", smtp_server);
    println!("  Port: {}", smtp_port);
    println!("  Username: {}", smtp_username);
    println!("  From: {}", from_email);
    println!("  Password: {}", if smtp_password.is_empty() { "NOT SET ❌" } else { "SET ✅" });

    if smtp_username.is_empty() || smtp_password.is_empty() {
        println!("❌ SMTP credentials not configured!");
        return Ok(());
    }

    // Create email
    let email_body = "This is a test email from Vocabulary App!\n\nIf you received this, email is working correctly.";
    let email = Message::builder()
        .from(from_email.parse()?)
        .to("perkasaid.rio@gmail.com".parse()?) // Your Gmail address
        .subject("Test Email - Vocabulary App")
        .body(email_body.to_string())?;

    // Create SMTP transport with timeout
    let creds = Credentials::new(smtp_username, smtp_password);
    let mailer = SmtpTransport::relay(&smtp_server)?
        .port(smtp_port)
        .credentials(creds)
        .timeout(Some(std::time::Duration::from_secs(10))) // 10 second timeout
        .build();

    // Try to send
    println!("📤 Attempting to send test email...");
    match mailer.send(&email) {
        Ok(_) => println!("✅ Email sent successfully!"),
        Err(e) => println!("❌ Failed to send email: {}", e),
    }

    Ok(())
}