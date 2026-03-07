mod chrome;
#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};

pub(crate) const DEFAULT_TIMEOUT_MS: u64 = 30_000;
pub(crate) const DEFAULT_WIDTH: u32 = 1280;
pub(crate) const DEFAULT_HEIGHT: u32 = 720;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderUrlArgs {
    pub url: String,
    pub timeout_ms: Option<u64>,
    pub screenshot: Option<bool>,
    pub pdf: Option<bool>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RenderUrlResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_base64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub source: String,
}

impl RenderUrlResult {
    pub(crate) fn err(url: &str, msg: String) -> Self {
        Self {
            ok: false,
            screenshot_base64: None,
            pdf_base64: None,
            error: Some(msg),
            source: url.to_string(),
        }
    }
}

#[tauri::command]
pub async fn render_url(args: RenderUrlArgs) -> Result<RenderUrlResult, String> {
    let url = args.url.clone();
    let timeout = args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
    let screenshot = args.screenshot.unwrap_or(true);
    let pdf = args.pdf.unwrap_or(false);
    let width = args.window_width.unwrap_or(DEFAULT_WIDTH);
    let height = args.window_height.unwrap_or(DEFAULT_HEIGHT);

    if !screenshot && !pdf {
        return Ok(RenderUrlResult::err(
            &url,
            "At least one of screenshot or pdf must be true".into(),
        ));
    }

    // Run with overall timeout
    match tokio::time::timeout(
        std::time::Duration::from_millis(timeout),
        chrome::render(&url, screenshot, pdf, width, height),
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(_) => Ok(RenderUrlResult::err(&url, "Chrome render timed out".into())),
    }
}
