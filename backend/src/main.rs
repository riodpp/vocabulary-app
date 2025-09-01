use rusqlite::Connection;
use actix_web::{web, App, HttpServer, Result, middleware::Logger};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use std::io::Result as IoResult;
use std::sync::Mutex;

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
struct Progress {
    id: Option<i64>,
    word_id: i64,
    correct: i32,
    wrong: i32,
    last_reviewed: Option<String>,
}

#[derive(Deserialize)]
struct CreateWordRequest {
    english: String,
    directory_id: Option<i64>,
}

#[derive(Deserialize)]
struct ProgressRequest {
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
    // Translate using LibreTranslate
    let translation = translate_text(&req.english).await.unwrap_or_else(|_| "Translation failed".to_string());

    let conn = data.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO words (english, indonesian, directory_id) VALUES (?, ?, ?)",
        rusqlite::params![req.english, translation, req.directory_id],
    ).expect("Failed to insert word");

    let id = conn.last_insert_rowid();
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

    for result in &req.results {
        // Check if progress record exists for this word
        let existing: Result<i32, _> = conn.query_row(
            "SELECT COUNT(*) FROM progress WHERE word_id = ?",
            [result.word_id],
            |row| row.get(0)
        );

        match existing {
            Ok(count) if count > 0 => {
                // Update existing progress
                if result.correct {
                    conn.execute(
                        "UPDATE progress SET correct = correct + 1, last_reviewed = datetime('now') WHERE word_id = ?",
                        [result.word_id]
                    ).expect("Failed to update progress");
                } else {
                    conn.execute(
                        "UPDATE progress SET wrong = wrong + 1, last_reviewed = datetime('now') WHERE word_id = ?",
                        [result.word_id]
                    ).expect("Failed to update progress");
                }
            },
            _ => {
                // Insert new progress record
                conn.execute(
                    "INSERT INTO progress (word_id, correct, wrong, last_reviewed) VALUES (?, ?, ?, datetime('now'))",
                    rusqlite::params![
                        result.word_id,
                        if result.correct { 1 } else { 0 },
                        if result.correct { 0 } else { 1 }
                    ]
                ).expect("Failed to insert progress");
            }
        }
    }

    Ok(web::Json("Progress saved successfully".to_string()))
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

async fn improve_translation_with_ai(text: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_else(|_| "".to_string());

    if api_key.is_empty() {
        return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
    }

    let prompt = format!("Translate the English word '{}' to Indonesian. Provide only the Indonesian translation, no additional text or explanation.", text);

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
    let client = reqwest::Client::new();
    let res = client
        .post("https://libretranslate.com/translate")
        .json(&serde_json::json!({
            "q": text,
            "source": "en",
            "target": "id"
        }))
        .send()
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    if !res.status().is_success() {
        return Err(actix_web::error::ErrorInternalServerError("LibreTranslate API error"));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    Ok(json["translatedText"].as_str().unwrap_or("Translation failed").to_string())
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

struct AppState {
    conn: Mutex<Connection>,
}

#[actix_web::main]
async fn main() -> IoResult<()> {
    // Load environment variables
    dotenv::dotenv().ok();

    // Create database connection
    let conn = Connection::open("vocabulary.db").expect("Failed to open database");

    // Create tables
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
        "CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY,
            word_id INTEGER,
            correct INTEGER DEFAULT 0,
            wrong INTEGER DEFAULT 0,
            last_reviewed DATETIME,
            FOREIGN KEY(word_id) REFERENCES words(id)
        )",
        [],
    ).expect("Failed to create progress table");

    println!("Database initialized successfully.");

    let app_state = web::Data::new(AppState { conn: Mutex::new(conn) });

    // Start the server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(app_state.clone())
            .route("/", web::get().to(|| async { "Hello from vocabulary backend!" }))
            .route("/words", web::post().to(create_word))
            .route("/words", web::get().to(get_words))
            .route("/words/{id}", web::put().to(update_word))
            .route("/words/{id}", web::delete().to(delete_word))
            .route("/words/{id}/ai-translate", web::post().to(|path: web::Path<i64>, data: web::Data<AppState>| async move {
                let word_id = path.into_inner();
                let conn = data.conn.lock().unwrap();

                // Get the word
                let mut stmt = conn.prepare("SELECT english FROM words WHERE id = ?").unwrap();
                let english: String = stmt.query_row([word_id], |row| row.get(0)).unwrap_or_else(|_| "unknown".to_string());

                // Get AI translation
                match improve_translation_with_ai(&english).await {
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
            .route("/directories", web::post().to(create_directory))
            .route("/directories", web::get().to(get_directories))
            .route("/directories/{id}", web::delete().to(delete_directory))
            .route("/progress", web::post().to(save_progress))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
