/// Detect proxy from environment variables or macOS system proxy.
pub fn detect_proxy() -> Option<String> {
    // 1. Check environment variables (works on all platforms)
    for var in [
        "https_proxy",
        "HTTPS_PROXY",
        "http_proxy",
        "HTTP_PROXY",
        "ALL_PROXY",
        "all_proxy",
    ] {
        if let Ok(val) = std::env::var(var) {
            let trimmed = val.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }

    // 2. macOS: read system HTTP proxy via networksetup
    #[cfg(target_os = "macos")]
    {
        if let Some(proxy) = detect_macos_system_proxy() {
            return Some(proxy);
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn detect_macos_system_proxy() -> Option<String> {
    // Try HTTPS proxy first, then HTTP
    for service in ["Web", "Secure Web"] {
        let kind = if service == "Web" {
            "webproxy"
        } else {
            "securewebproxy"
        };
        let output = std::process::Command::new("networksetup")
            .args([&format!("-get{kind}"), "Wi-Fi"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut enabled = false;
        let mut server = String::new();
        let mut port = String::new();
        for line in text.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("Enabled:") {
                enabled = val.trim() == "Yes";
            } else if let Some(val) = line.strip_prefix("Server:") {
                server = val.trim().to_string();
            } else if let Some(val) = line.strip_prefix("Port:") {
                port = val.trim().to_string();
            }
        }
        if enabled && !server.is_empty() && !port.is_empty() && port != "0" {
            let scheme = if service == "Secure Web" {
                "https"
            } else {
                "http"
            };
            return Some(format!("{scheme}://{server}:{port}"));
        }
    }

    // Also check SOCKS proxy
    let output = std::process::Command::new("networksetup")
        .args(["-getsocksfirewallproxy", "Wi-Fi"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let mut enabled = false;
    let mut server = String::new();
    let mut port = String::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("Enabled:") {
            enabled = val.trim() == "Yes";
        } else if let Some(val) = line.strip_prefix("Server:") {
            server = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("Port:") {
            port = val.trim().to_string();
        }
    }
    if enabled && !server.is_empty() && !port.is_empty() && port != "0" {
        return Some(format!("socks5://{server}:{port}"));
    }

    None
}
