use rusqlite::Connection;
use actix_web::{web, App, HttpServer, Result, middleware::Logger, HttpResponse};
use actix_web::HttpRequest;
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use std::io::Result as IoResult;
use std::sync::Mutex;
use sqlx::PgPool;

mod models;
mod auth;

use crate::auth::AuthService;
use crate::models::*;

#[derive(Serialize, Deserialize)]
struct Directory {
    id: Option<i64>,
    name: String,
}

#[derive(Serialize, Deserialize)]
struct Word {
    id: Option<i64>,
    english: String,
    indonesian: Option<String>,
    directory_id: Option<i64>,
}

#[derive(Serialize, Deserialize)]
struct Session {
    id: Option<i64>,
    directory_id: Option<i64>,
    total_words: i32,
    correct: i32,
    wrong: i32,
    created_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SessionHistory {
    id: i64,
    directory_name: Option<String>,
    total_words: i32,
    correct: i32,
    wrong: i32,
    score_percentage: f64,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
struct Progress {
    id: Option<i64>,
    word_id: i64,
    session_id: Option<i64>,
    correct: i32,
    wrong: i32,
    last_reviewed: Option<String>,
}

#[derive(Deserialize)]
struct CreateWordRequest {
    english: String,
    indonesian: Option<String>,
    directory_id: Option<i64>,
}

#[derive(Deserialize)]
struct ProgressRequest {
    directory_id: Option<i64>,
    total_words: i32,
    results: Vec<ProgressResult>,
}

#[derive(Deserialize)]
struct ProgressResult {
    word_id: i64,
    correct: bool,
}

#[derive(Deserialize)]
struct UpdateWordRequest {
    indonesian: String,
}

async fn create_word(
    req: web::Json<CreateWordRequest>,
    data: web::Data<AppState>,
) -> Result<web::Json<Word>> {
    println!("Creating word: {}", req.english);

    // Use provided translation or translate automatically
    let translation = if let Some(indonesian) = &req.indonesian {
        if !indonesian.trim().is_empty() {
            indonesian.clone()
        } else {
            translate_text(&req.english).await.unwrap_or_else(|_| "Translation failed".to_string())
        }
    } else {
        translate_text(&req.english).await.unwrap_or_else(|_| "Translation failed".to_string())
    };
    println!("Translation for '{}': {}", req.english, translation);

    let conn = data.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO words (english, indonesian, directory_id) VALUES (?, ?, ?)",
        rusqlite::params![req.english, translation, req.directory_id],
    ).expect("Failed to insert word");

    let id = conn.last_insert_rowid();
    println!("Created word with ID: {}", id);

    Ok(web::Json(Word {
        id: Some(id),
        english: req.english.clone(),
        indonesian: Some(translation),
        directory_id: req.directory_id,
    }))
}

async fn get_words(data: web::Data<AppState>) -> Result<web::Json<Vec<Word>>> {
    let conn = data.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, english, indonesian, directory_id FROM words").unwrap();
    let words_iter = stmt.query_map([], |row| {
        Ok(Word {
            id: row.get(0)?,
            english: row.get(1)?,
            indonesian: row.get(2)?,
            directory_id: row.get(3)?,
        })
    }).unwrap();

    let words: Vec<Word> = words_iter.map(|w| w.unwrap()).collect();
    println!("Fetched {} words from database", words.len());
    Ok(web::Json(words))
}

async fn get_words_by_directory(
    path: web::Path<i64>,
    data: web::Data<AppState>,
) -> Result<web::Json<Vec<Word>>> {
    let directory_id = path.into_inner();
    let conn = data.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, english, indonesian, directory_id FROM words WHERE directory_id = ?").unwrap();
    let words_iter = stmt.query_map([directory_id], |row| {
        Ok(Word {
            id: row.get(0)?,
            english: row.get(1)?,
            indonesian: row.get(2)?,
            directory_id: row.get(3)?,
        })
    }).unwrap();

    let words: Vec<Word> = words_iter.map(|w| w.unwrap()).collect();
    println!("Fetched {} words from directory {}", words.len(), directory_id);
    Ok(web::Json(words))
}

async fn create_directory(
    req: web::Json<Directory>,
    data: web::Data<AppState>,
) -> Result<web::Json<Directory>> {
    let conn = data.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO directories (name) VALUES (?)",
        rusqlite::params![req.name],
    ).expect("Failed to insert directory");

    let id = conn.last_insert_rowid();
    Ok(web::Json(Directory {
        id: Some(id),
        name: req.name.clone(),
    }))
}

async fn get_directories(data: web::Data<AppState>) -> Result<web::Json<Vec<Directory>>> {
    let conn = data.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name FROM directories").unwrap();
    let dirs_iter = stmt.query_map([], |row| {
        Ok(Directory {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    }).unwrap();

    let dirs: Vec<Directory> = dirs_iter.map(|d| d.unwrap()).collect();
    Ok(web::Json(dirs))
}

async fn delete_word(
    path: web::Path<i64>,
    data: web::Data<AppState>,
) -> Result<web::Json<String>> {
    let word_id = path.into_inner();
    let conn = data.conn.lock().unwrap();

    conn.execute("DELETE FROM words WHERE id = ?", [word_id])
        .expect("Failed to delete word");

    Ok(web::Json("Word deleted successfully".to_string()))
}

async fn delete_directory(
    path: web::Path<i64>,
    data: web::Data<AppState>,
) -> Result<web::Json<String>> {
    let dir_id = path.into_inner();
    let conn = data.conn.lock().unwrap();

    // First delete all words in this directory
    conn.execute("DELETE FROM words WHERE directory_id = ?", [dir_id])
        .expect("Failed to delete words in directory");

    // Then delete the directory
    conn.execute("DELETE FROM directories WHERE id = ?", [dir_id])
        .expect("Failed to delete directory");

    Ok(web::Json("Directory deleted successfully".to_string()))
}

async fn save_progress(
    req: web::Json<ProgressRequest>,
    data: web::Data<AppState>,
) -> Result<web::Json<String>> {
    let conn = data.conn.lock().unwrap();

    // Calculate totals
    let correct_count = req.results.iter().filter(|r| r.correct).count() as i32;
    let wrong_count = req.results.len() as i32 - correct_count;

    // Create new session
    conn.execute(
        "INSERT INTO sessions (directory_id, total_words, correct, wrong, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        rusqlite::params![req.directory_id, req.total_words, correct_count, wrong_count],
    ).expect("Failed to insert session");

    let session_id = conn.last_insert_rowid();

    // Save progress for each word linked to the session
    for result in &req.results {
        conn.execute(
            "INSERT INTO progress (word_id, session_id, correct, wrong, last_reviewed) VALUES (?, ?, ?, ?, datetime('now'))",
            rusqlite::params![
                result.word_id,
                session_id,
                if result.correct { 1 } else { 0 },
                if result.correct { 0 } else { 1 }
            ]
        ).expect("Failed to insert progress");
    }

    Ok(web::Json("Progress saved successfully".to_string()))
}

async fn get_session_history(
    query: web::Query<std::collections::HashMap<String, String>>,
    data: web::Data<AppState>,
) -> Result<web::Json<Vec<SessionHistory>>> {
    let conn = data.conn.lock().unwrap();

    // Get page parameter, default to 1
    let page = query.get("page").and_then(|p| p.parse::<i64>().ok()).unwrap_or(1);
    let limit = 15;
    let offset = (page - 1) * limit;

    let mut stmt = conn.prepare(
        "SELECT s.id, d.name, s.total_words, s.correct, s.wrong, s.created_at
         FROM sessions s
         LEFT JOIN directories d ON s.directory_id = d.id
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?"
    ).unwrap();

    let session_iter = stmt.query_map([limit, offset], |row| {
        let total_words: i32 = row.get(2)?;
        let correct: i32 = row.get(3)?;
        let wrong: i32 = row.get(4)?;
        let score_percentage = if total_words > 0 {
            (correct as f64 / total_words as f64) * 100.0
        } else {
            0.0
        };

        Ok(SessionHistory {
            id: row.get(0)?,
            directory_name: row.get(1)?,
            total_words,
            correct,
            wrong,
            score_percentage,
            created_at: row.get(5)?,
        })
    }).unwrap();

    let sessions: Vec<SessionHistory> = session_iter.map(|s| s.unwrap()).collect();

    Ok(web::Json(sessions))
}

async fn update_word(
    path: web::Path<i64>,
    req: web::Json<UpdateWordRequest>,
    data: web::Data<AppState>,
) -> Result<web::Json<Word>> {
    let word_id = path.into_inner();
    let conn = data.conn.lock().unwrap();

    conn.execute(
        "UPDATE words SET indonesian = ? WHERE id = ?",
        rusqlite::params![req.indonesian, word_id],
    ).expect("Failed to update word");

    // Fetch the updated word
    let mut stmt = conn.prepare("SELECT id, english, indonesian, directory_id FROM words WHERE id = ?").unwrap();
    let word = stmt.query_row([word_id], |row| {
        Ok(Word {
            id: row.get(0)?,
            english: row.get(1)?,
            indonesian: row.get(2)?,
            directory_id: row.get(3)?,
        })
    }).expect("Failed to fetch updated word");

    Ok(web::Json(word))
}

async fn improve_translation_with_ai(text: &str, from: &str, to: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_else(|_| "".to_string());

    if api_key.is_empty() {
        return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
    }

    let from_lang = match from {
        "en" => "English",
        "id" => "Indonesian",
        _ => "English",
    };
    let to_lang = match to {
        "en" => "English",
        "id" => "Indonesian",
        _ => "Indonesian",
    };

    let prompt = format!("Translate the {} word '{}' to {}. Provide only the {} translation, no additional text or explanation.", from_lang, text, to_lang, to_lang);

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "anthropic/claude-3-haiku",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 100,
            "temperature": 0.1
        }))
        .send()
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("OpenRouter API error: {}", e)))?;

    if !res.status().is_success() {
        return Err(actix_web::error::ErrorInternalServerError("OpenRouter API request failed"));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        Ok(content.trim().to_string())
    } else {
        Err(actix_web::error::ErrorInternalServerError("Invalid response format from OpenRouter"))
    }
}

async fn explain_sentence_with_ai(sentence: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_else(|_| "".to_string());

    if api_key.is_empty() {
        return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
    }

    let prompt = format!("Explain the meaning of this English sentence in Indonesian: '{}'. Provide a clear and concise explanation in Indonesian.", sentence);

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "anthropic/claude-3-haiku",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 300,
            "temperature": 0.3
        }))
        .send()
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("OpenRouter API error: {}", e)))?;

    if !res.status().is_success() {
        return Err(actix_web::error::ErrorInternalServerError("OpenRouter API request failed"));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        Ok(content.trim().to_string())
    } else {
        Err(actix_web::error::ErrorInternalServerError("Invalid response format from OpenRouter"))
    }
}

async fn translate_text(text: &str) -> Result<String> {
    // Clean the input text
    let clean_text = text.trim().to_lowercase();

    // Try LibreTranslate first
    match try_libretranslate(&clean_text).await {
        Ok(translation) => {
            if is_valid_translation(&translation, &clean_text) {
                return Ok(translation);
            }
        }
        Err(_) => {}
    }

    // Fallback to MyMemory API
    match try_mymemory(&clean_text).await {
        Ok(translation) => {
            if is_valid_translation(&translation, &clean_text) {
                return Ok(translation);
            }
        }
        Err(_) => {}
    }

    // Try Google Translate via free API
    match try_google_translate(&clean_text).await {
        Ok(translation) => {
            if is_valid_translation(&translation, &clean_text) {
                return Ok(translation);
            }
        }
        Err(_) => {}
    }

    // Final fallback - check dictionary or return placeholder
    match get_fallback_translation(&clean_text) {
        Some(translation) => return Ok(translation.to_string()),
        None => Ok("Translation unavailable".to_string())
    }
}

async fn try_libretranslate(text: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Client build error: {}", e)))?;

    let res = client
        .post("https://libretranslate.com/translate")
        .json(&serde_json::json!({
            "q": text,
            "source": "en",
            "target": "id"
        }))
        .send()
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("LibreTranslate request error: {}", e)))?;

    if !res.status().is_success() {
        println!("LibreTranslate API error: {}", res.status());
        return Err(actix_web::error::ErrorInternalServerError("LibreTranslate API error"));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| actix_web::error::ErrorInternalServerError(format!("JSON parse error: {}", e)))?;
    let translation = json["translatedText"].as_str().unwrap_or("Translation failed").to_string();
    println!("LibreTranslate result: {}", translation);
    Ok(translation)
}

async fn try_mymemory(text: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!("https://api.mymemory.translated.net/get?q={}&langpair=en|id", urlencoding::encode(text));

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if !res.status().is_success() {
        return Err(actix_web::error::ErrorInternalServerError("MyMemory API error"));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if let Some(translation) = json["responseData"]["translatedText"].as_str() {
        Ok(translation.to_string())
    } else {
        Err(actix_web::error::ErrorInternalServerError("Invalid response format"))
    }
}

fn is_valid_translation(translation: &str, original: &str) -> bool {
    let trans_lower = translation.to_lowercase();
    let orig_lower = original.to_lowercase();

    // Translation should not be the same as original
    if trans_lower == orig_lower {
        return false;
    }

    // Translation should not be "translation failed" or similar error messages
    if trans_lower.contains("translation") && trans_lower.contains("fail") {
        return false;
    }

    // Basic check: translation should be different and not empty
    !translation.trim().is_empty() && translation.len() > 1
}

fn get_fallback_translation(text: &str) -> Option<&'static str> {
    // Simple hardcoded dictionary for common words
    match text.to_lowercase().as_str() {
        "hello" => Some("halo"),
        "goodbye" => Some("selamat tinggal"),
        "thank you" => Some("terima kasih"),
        "please" => Some("tolong"),
        "yes" => Some("ya"),
        "no" => Some("tidak"),
        "water" => Some("air"),
        "food" => Some("makanan"),
        "house" => Some("rumah"),
        "car" => Some("mobil"),
        "book" => Some("buku"),
        "school" => Some("sekolah"),
        "friend" => Some("teman"),
        "family" => Some("keluarga"),
        "love" => Some("cinta"),
        "time" => Some("waktu"),
        "day" => Some("hari"),
        "night" => Some("malam"),
        "sun" => Some("matahari"),
        "moon" => Some("bulan"),
        "perceive" => Some("merasakan"),
        _ => None,
    }
}

async fn try_google_translate(_text: &str) -> Result<String> {
    // Placeholder - Google Translate API requires API key and is more complex
    // For now, return error to skip
    Err(actix_web::error::ErrorInternalServerError("Google Translate not implemented"))
}

// Authentication endpoints
async fn register(
    req: web::Json<RegisterRequest>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    match data.auth_service.register_user(req.into_inner()).await {
        Ok(user) => {
            let response = ApiResponse::success(
                "User registered successfully. Please check your email for verification code.".to_string(),
                serde_json::json!({
                    "user_id": user.id,
                    "email": user.email
                })
            );
            Ok(HttpResponse::Created().json(response))
        }
        Err(e) => {
            let response = ApiResponse::<()>::error(e.to_string());
            Ok(HttpResponse::BadRequest().json(response))
        }
    }
}

async fn verify_email(
    req: web::Json<VerifyEmailRequest>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    match data.auth_service.verify_email(req.into_inner()).await {
        Ok(user) => {
            let response = ApiResponse::success(
                "Email verified successfully. You can now log in.".to_string(),
                serde_json::json!({
                    "user_id": user.id,
                    "email": user.email,
                    "is_verified": user.is_verified
                })
            );
            Ok(HttpResponse::Ok().json(response))
        }
        Err(e) => {
            let response = ApiResponse::<()>::error(e.to_string());
            Ok(HttpResponse::BadRequest().json(response))
        }
    }
}

async fn login(
    req: web::Json<LoginRequest>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    match data.auth_service.login_user(req.into_inner()).await {
        Ok(auth_response) => {
            let response = ApiResponse::success(
                "Login successful".to_string(),
                auth_response
            );
            Ok(HttpResponse::Ok().json(response))
        }
        Err(e) => {
            let response = ApiResponse::<()>::error(e.to_string());
            Ok(HttpResponse::Unauthorized().json(response))
        }
    }
}

async fn logout(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..]; // Remove "Bearer " prefix
                match data.auth_service.logout_user(token).await {
                    Ok(_) => {
                        let response = ApiResponse::<()>::success("Logged out successfully".to_string(), ());
                        return Ok(HttpResponse::Ok().json(response));
                    }
                    Err(_) => {} // Continue to error response
                }
            }
        }
    }

    let response = ApiResponse::<()>::error("Invalid token".to_string());
    Ok(HttpResponse::BadRequest().json(response))
}

async fn get_profile(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..]; // Remove "Bearer " prefix
                match data.auth_service.validate_token(token).await {
                    Ok(user) => {
                        // Get user's subscription
                        let subscription = sqlx::query_as::<_, Subscription>(
                            "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1"
                        )
                        .bind(user.id)
                        .fetch_optional(&data.pg_pool)
                        .await
                        .unwrap_or(None);

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

                        let response = ApiResponse::success("Profile retrieved successfully".to_string(), user_response);
                        return Ok(HttpResponse::Ok().json(response));
                    }
                    Err(_) => {} // Continue to error response
                }
            }
        }
    }

    let response = ApiResponse::<()>::error("Invalid or missing token".to_string());
    Ok(HttpResponse::Unauthorized().json(response))
}

struct AppState {
    conn: Mutex<Connection>, // SQLite for existing vocabulary data
    pg_pool: PgPool,         // PostgreSQL for user accounts
    auth_service: AuthService,
}

#[actix_web::main]
async fn main() -> IoResult<()> {
    println!("Starting vocabulary backend...");

    // Load environment variables
    dotenv::dotenv().ok();
    println!("Environment variables loaded");

    // Set up PostgreSQL connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost/vocabulary_app".to_string());

    println!("Connecting to PostgreSQL...");
    let pg_pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    // Run migrations
    println!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pg_pool)
        .await
        .expect("Failed to run migrations");

    println!("PostgreSQL initialized successfully");

    // Create SQLite connection for existing vocabulary data
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "data/vocabulary.db".to_string());
    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");

    // Create tables (keeping existing SQLite structure for now)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS directories (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )",
        [],
    ).expect("Failed to create directories table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY,
            english TEXT NOT NULL,
            indonesian TEXT,
            directory_id INTEGER,
            FOREIGN KEY(directory_id) REFERENCES directories(id)
        )",
        [],
    ).expect("Failed to create words table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY,
            directory_id INTEGER,
            total_words INTEGER,
            correct INTEGER DEFAULT 0,
            wrong INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(directory_id) REFERENCES directories(id)
        )",
        [],
    ).expect("Failed to create sessions table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY,
            word_id INTEGER,
            session_id INTEGER,
            correct INTEGER DEFAULT 0,
            wrong INTEGER DEFAULT 0,
            last_reviewed DATETIME,
            FOREIGN KEY(word_id) REFERENCES words(id),
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )",
        [],
    ).expect("Failed to create progress table");

    println!("SQLite database initialized successfully at: {}", db_path);

    // Initialize auth service
    let auth_service = AuthService::new(pg_pool.clone())
        .expect("Failed to initialize auth service");

    let app_state = web::Data::new(AppState {
        conn: Mutex::new(conn),
        pg_pool,
        auth_service,
    });

    println!("Starting HTTP server on 0.0.0.0:8080");

    // Start the server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("https://vocabulary-app-frontend.fly.dev")
            .allowed_origin("http://localhost:3000") // For local development
            .allowed_origin_fn(|origin, _req_head| {
                // Allow all origins for mobile browser compatibility
                origin.as_bytes().starts_with(b"http")
            })
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600); // Cache preflight for 1 hour

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(app_state.clone())
            .route("/", web::get().to(|| async { "Hello from vocabulary backend!" }))
            .route("/health", web::get().to(|| async { "OK" }))
            .route("/db-check", web::get().to(|data: web::Data<AppState>| async move {
                let conn = data.conn.lock().unwrap();
                let count: Result<i64, _> = conn.query_row("SELECT COUNT(*) FROM words", [], |row| row.get(0));
                match count {
                    Ok(count) => web::Json(serde_json::json!({ "status": "OK", "word_count": count })),
                    Err(e) => web::Json(serde_json::json!({ "status": "ERROR", "error": e.to_string() }))
                }
            }))
            // Authentication routes
            .route("/auth/register", web::post().to(register))
            .route("/auth/verify-email", web::post().to(verify_email))
            .route("/auth/login", web::post().to(login))
            .route("/auth/logout", web::post().to(logout))
            .route("/auth/profile", web::get().to(get_profile))
            // Vocabulary routes (keeping existing functionality)
            .route("/words", web::post().to(create_word))
            .route("/words", web::get().to(get_words))
            .route("/directories/{id}/words", web::get().to(get_words_by_directory))
            .route("/words/{id}", web::put().to(update_word))
            .route("/words/{id}", web::delete().to(delete_word))
            .route("/words/{id}/ai-translate", web::post().to(|path: web::Path<i64>, data: web::Data<AppState>| async move {
                let word_id = path.into_inner();
                let conn = data.conn.lock().unwrap();

                // Get the word
                let mut stmt = conn.prepare("SELECT english FROM words WHERE id = ?").unwrap();
                let english: String = stmt.query_row([word_id], |row| row.get(0)).unwrap_or_else(|_| "unknown".to_string());

                // Get AI translation
                match improve_translation_with_ai(&english, "en", "id").await {
                    Ok(translation) => {
                        // Update the word with AI translation
                        conn.execute(
                            "UPDATE words SET indonesian = ? WHERE id = ?",
                            rusqlite::params![translation, word_id],
                        ).expect("Failed to update word with AI translation");

                        web::Json(serde_json::json!({ "translation": translation }))
                    },
                    Err(e) => web::Json(serde_json::json!({ "error": e.to_string() }))
                }
            }))
            .route("/ai-translate", web::post().to(|req: web::Json<serde_json::Value>| async move {
                if let Some(text) = req["text"].as_str() {
                    let from = req["from"].as_str().unwrap_or("en");
                    let to = req["to"].as_str().unwrap_or("id");
                    match improve_translation_with_ai(text, from, to).await {
                        Ok(translation) => web::Json(serde_json::json!({ "translation": translation })),
                        Err(e) => web::Json(serde_json::json!({ "error": e.to_string() }))
                    }
                } else {
                    web::Json(serde_json::json!({ "error": "Missing 'text' field" }))
                }
            }))
            .route("/explain-sentence", web::post().to(|req: web::Json<serde_json::Value>| async move {
                if let Some(sentence) = req["sentence"].as_str() {
                    match explain_sentence_with_ai(sentence).await {
                        Ok(explanation) => web::Json(serde_json::json!({ "explanation": explanation })),
                        Err(e) => web::Json(serde_json::json!({ "error": e.to_string() }))
                    }
                } else {
                    web::Json(serde_json::json!({ "error": "Missing 'sentence' field" }))
                }
            }))
            .route("/directories", web::post().to(create_directory))
            .route("/directories", web::get().to(get_directories))
            .route("/directories/{id}", web::delete().to(delete_directory))
            .route("/progress", web::post().to(save_progress))
            .route("/sessions", web::get().to(get_session_history))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
