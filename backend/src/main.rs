use actix_web::{web, App, HttpServer, Result, middleware::Logger, HttpResponse};
use actix_web::HttpRequest;
use actix_cors::Cors;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use std::io::Result as IoResult;
use sqlx::PgPool;
use reqwest::Client;

mod models;

use crate::models::*;

// Translation structs
#[derive(Deserialize)]
struct TranslateRequest {
    text: String,
    from: Option<String>,
    to: Option<String>,
}

#[derive(Serialize)]
struct TranslateResponse {
    translation: String,
}

// Sentence explanation structs
#[derive(Deserialize)]
struct ExplainSentenceRequest {
    sentence: String,
}

#[derive(Serialize)]
struct ExplainSentenceResponse {
    translation: String,
    explanation: String,
}

// Vocabulary extraction structs
#[derive(Deserialize)]
struct ExtractVocabularyRequest {
    sentence: String,
}

#[derive(Serialize)]
struct ExtractVocabularyResponse {
    vocabulary: Vec<String>,
}

// Translation function using OpenRouter API
async fn translate_text(text: &str, from: Option<String>, to: Option<String>) -> Result<String> {
    println!("Starting translation for: {} (from: {:?}, to: {:?})", text, from, to);

    let openrouter_api_key = match std::env::var("OPENROUTER_API_KEY") {
        Ok(key) => {
            println!("OpenRouter API key found (length: {})", key.len());
            key
        }
        Err(_) => {
            println!("OpenRouter API key not found in environment");
            return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
        }
    };

    let client = Client::new();

    // Determine source and target languages
    let from_lang = from.as_deref().unwrap_or("en");
    let to_lang = to.as_deref().unwrap_or("id");

    let from_language_name = match from_lang {
        "en" => "English",
        "id" => "Indonesian",
        _ => "English"
    };

    let to_language_name = match to_lang {
        "en" => "English",
        "id" => "Indonesian",
        _ => "Indonesian"
    };

    let request_body = serde_json::json!({
        "model": "openrouter/sonoma-dusk-alpha",
        "messages": [
            {
                "role": "system",
                "content": format!("You are a professional translator. Translate the given {} text to {}. Only return the translation, nothing else.", from_language_name, to_language_name)
            },
            {
                "role": "user",
                "content": format!("Translate this {} text to {}: {}", from_language_name, to_language_name, text)
            }
        ],
        "max_tokens": 100,
        "temperature": 0.3
    });

    println!("Sending request to OpenRouter API...");
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", openrouter_api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            println!("OpenRouter API request failed: {:?}", e);
            actix_web::error::ErrorInternalServerError("Translation service temporarily unavailable")
        })?;

    println!("OpenRouter API response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("OpenRouter API error ({}): {}", status, error_text);
        return Err(actix_web::error::ErrorInternalServerError("Translation service error"));
    }

    let response_text = response.text().await
        .map_err(|e| {
            println!("Failed to read response text: {:?}", e);
            actix_web::error::ErrorInternalServerError("Translation service error")
        })?;

    println!("Raw response: {}", response_text);

    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            println!("Failed to parse JSON response: {:?}, Raw: {}", e, response_text);
            actix_web::error::ErrorInternalServerError("Translation service error")
        })?;

    println!("Parsed JSON response successfully");

    let translation = response_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Translation unavailable")
        .trim()
        .to_string();

    println!("Final translation: {}", translation);
    Ok(translation)
}

// Sentence explanation function using OpenRouter API
async fn explain_sentence(sentence: &str) -> Result<String> {
    println!("Starting sentence explanation for: {}", sentence);

    let openrouter_api_key = match std::env::var("OPENROUTER_API_KEY") {
        Ok(key) => {
            println!("OpenRouter API key found (length: {})", key.len());
            key
        }
        Err(_) => {
            println!("OpenRouter API key not found in environment");
            return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
        }
    };

    let client = Client::new();

    let request_body = serde_json::json!({
        "model": "openrouter/sonoma-dusk-alpha",
        "messages": [
            {
                "role": "system",
                "content": "You are an assistant that analyzes English sentences for Indonesian learners, give the analysis directly in Indonesian (no introduction), focusing on grammar and natural alternatives, and always use this format: 1. **Grammar Analysis** - jelaskan tenses, aspek, struktur subjek-kata kerja-objek, dan poin grammar penting; 2. **Natural Alternatives** - berikan cara lain yang lebih natural untuk menyampaikan ide yang sama dalam bahasa Inggris."
            },
            {
                "role": "user",
                "content": format!("Please explain this English sentence: \"{}\"", sentence)
            }
        ],
        "max_tokens": 800,
        "temperature": 0.5
    });

    println!("Sending sentence explanation request to OpenRouter API...");
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", openrouter_api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            println!("OpenRouter API request failed: {:?}", e);
            actix_web::error::ErrorInternalServerError("Explanation service temporarily unavailable")
        })?;

    println!("OpenRouter API response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("OpenRouter API error ({}): {}", status, error_text);
        return Err(actix_web::error::ErrorInternalServerError("Explanation service error"));
    }

    let response_text = response.text().await
        .map_err(|e| {
            println!("Failed to read response text: {:?}", e);
            actix_web::error::ErrorInternalServerError("Explanation service error")
        })?;

    println!("Raw response: {}", response_text);

    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            println!("Failed to parse JSON response: {:?}, Raw: {}", e, response_text);
            actix_web::error::ErrorInternalServerError("Explanation service error")
        })?;

    println!("Parsed JSON response successfully");

    let explanation = response_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Explanation unavailable")
        .trim()
        .to_string();

    println!("Final explanation: {}", explanation);
    Ok(explanation)
}

// Vocabulary extraction function using OpenRouter API
async fn extract_vocabulary(sentence: &str) -> Result<Vec<String>> {
    println!("Starting vocabulary extraction for: {}", sentence);

    let openrouter_api_key = match std::env::var("OPENROUTER_API_KEY") {
        Ok(key) => {
            println!("OpenRouter API key found (length: {})", key.len());
            key
        }
        Err(_) => {
            println!("OpenRouter API key not found in environment");
            return Err(actix_web::error::ErrorInternalServerError("OpenRouter API key not configured"));
        }
    };

    let client = Client::new();

    let request_body = serde_json::json!({
        "model": "openrouter/sonoma-dusk-alpha",
        "messages": [
            {
                "role": "system",
                "content": "You are a language learning assistant. Extract the most important vocabulary words from an English sentence that would be valuable for Indonesian learners to learn. Focus on:\n- Key nouns, verbs, adjectives, and adverbs\n- Words that are central to understanding the sentence\n- Words that might be challenging for language learners\n- Avoid very common words like 'the', 'a', 'is', 'are', 'and', 'or', 'but'\n\nReturn only a JSON array of strings containing the vocabulary words, nothing else. Example: [\"important\", \"vocabulary\", \"words\"]"
            },
            {
                "role": "user",
                "content": format!("Extract key vocabulary words from this English sentence: \"{}\"", sentence)
            }
        ],
        "max_tokens": 200,
        "temperature": 0.3
    });

    println!("Sending vocabulary extraction request to OpenRouter API...");
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", openrouter_api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            println!("OpenRouter API request failed: {:?}", e);
            actix_web::error::ErrorInternalServerError("Vocabulary extraction service temporarily unavailable")
        })?;

    println!("OpenRouter API response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("OpenRouter API error ({}): {}", status, error_text);
        return Err(actix_web::error::ErrorInternalServerError("Vocabulary extraction service error"));
    }

    let response_text = response.text().await
        .map_err(|e| {
            println!("Failed to read response text: {:?}", e);
            actix_web::error::ErrorInternalServerError("Vocabulary extraction service error")
        })?;

    println!("Raw response: {}", response_text);

    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            println!("Failed to parse JSON response: {:?}, Raw: {}", e, response_text);
            actix_web::error::ErrorInternalServerError("Vocabulary extraction service error")
        })?;

    println!("Parsed JSON response successfully");

    let vocabulary_text = response_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("[]")
        .trim()
        .to_string();

    println!("Vocabulary response: {}", vocabulary_text);

    // Parse the JSON array
    let vocabulary: Vec<String> = serde_json::from_str(&vocabulary_text)
        .unwrap_or_else(|_| {
            println!("Failed to parse vocabulary JSON, returning empty array");
            Vec::new()
        });

    println!("Extracted vocabulary: {:?}", vocabulary);
    Ok(vocabulary)
}

// Sentence explanation endpoint handler
async fn explain_sentence_handler(
    req: web::Json<ExplainSentenceRequest>,
) -> Result<HttpResponse> {
    println!("Received sentence explanation request for: {}", req.sentence);

    // Get both translation and explanation
    let translation_result = translate_text(&req.sentence, Some("en".to_string()), Some("id".to_string())).await;
    let explanation_result = explain_sentence(&req.sentence).await;

    match (translation_result, explanation_result) {
        (Ok(translation), Ok(explanation)) => {
            println!("Sentence explanation successful");
            let response = ApiResponse::success(
                "Sentence explained successfully".to_string(),
                ExplainSentenceResponse { translation, explanation }
            );
            Ok(HttpResponse::Ok().json(response))
        }
        (Err(e), _) => {
            println!("Translation failed: {:?}", e);
            let response = ApiResponse::<()>::error("Translation service temporarily unavailable".to_string());
            Ok(HttpResponse::InternalServerError().json(response))
        }
        (_, Err(e)) => {
            println!("Explanation failed: {:?}", e);
            let response = ApiResponse::<()>::error("Explanation service temporarily unavailable".to_string());
            Ok(HttpResponse::InternalServerError().json(response))
        }
    }
}

// Vocabulary extraction endpoint handler
async fn extract_vocabulary_handler(
    req: web::Json<ExtractVocabularyRequest>,
) -> Result<HttpResponse> {
    println!("Received vocabulary extraction request for: {}", req.sentence);

    match extract_vocabulary(&req.sentence).await {
        Ok(vocabulary) => {
            println!("Vocabulary extraction successful: {} words found", vocabulary.len());
            let response = ApiResponse::success(
                "Vocabulary extracted successfully".to_string(),
                ExtractVocabularyResponse { vocabulary }
            );
            Ok(HttpResponse::Ok().json(response))
        }
        Err(e) => {
            println!("Vocabulary extraction failed: {:?}", e);
            let response = ApiResponse::<()>::error("Vocabulary extraction service temporarily unavailable".to_string());
            Ok(HttpResponse::InternalServerError().json(response))
        }
    }
}

// Translation endpoint handler
async fn ai_translate(
    req: web::Json<TranslateRequest>,
) -> Result<HttpResponse> {
    println!("Received translation request for: {} (from: {:?}, to: {:?})", req.text, req.from, req.to);

    match translate_text(&req.text, req.from.clone(), req.to.clone()).await {
        Ok(translation) => {
            println!("Translation successful: {} -> {}", req.text, translation);
            let response = ApiResponse::success(
                "Translation completed successfully".to_string(),
                TranslateResponse { translation }
            );
            Ok(HttpResponse::Ok().json(response))
        }
        Err(e) => {
            println!("Translation failed: {:?}", e);
            let response = ApiResponse::<()>::error("Translation service temporarily unavailable".to_string());
            Ok(HttpResponse::InternalServerError().json(response))
        }
    }
}


struct AppState {
    pg_pool: PgPool,         // PostgreSQL connection (may not be needed if no auth)
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
    println!("Vocabulary data now handled locally in frontend - no SQLite needed");
    println!("Authentication now handled by Supabase");

    let app_state = web::Data::new(AppState {
        pg_pool,
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
            // Translation endpoint
            .route("/ai-translate", web::post().to(ai_translate))
            // Sentence explanation endpoint
            .route("/explain-sentence", web::post().to(explain_sentence_handler))
            // Vocabulary extraction endpoint
            .route("/extract-vocabulary", web::post().to(extract_vocabulary_handler))
            // Authentication now handled by Supabase - auth routes removed
            // Vocabulary data handled locally
            // Catch-all route to serve React app for client-side routing
            .route("/{path:.*}", web::get().to(|| async {
                let index_path = PathBuf::from("../frontend/build/index.html");
                match std::fs::read_to_string(&index_path) {
                    Ok(content) => Ok::<HttpResponse, std::io::Error>(HttpResponse::Ok()
                        .content_type("text/html")
                        .body(content)),
                    Err(_) => Ok::<HttpResponse, std::io::Error>(HttpResponse::NotFound()
                        .body("Frontend not built. Please run 'npm run build' in the frontend directory."))
                }
            }))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
