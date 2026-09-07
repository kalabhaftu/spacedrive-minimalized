#[cfg(target_os = "macos")]
use std::process::Command;

fn main() {
	// Compile .icon to Assets.car on macOS
	#[cfg(target_os = "macos")]
	{
		let project_root = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
		let icon_source = format!("{}/../Spacedrive.icon", project_root);
		let gen_dir = format!("{}/gen", project_root);

		// Create gen directory
		std::fs::create_dir_all(&gen_dir).expect("Failed to create gen directory");

		// Check if actool utility and .icon file exist
		let has_actool = Command::new("xcrun")
			.args(["-find", "actool"])
			.output()
			.map(|o| o.status.success())
			.unwrap_or(false);

		if has_actool && std::path::Path::new(&icon_source).exists() {
			println!("cargo:rerun-if-changed={}", icon_source);

			// Run actool to compile .icon to Assets.car
			let output = Command::new("xcrun")
				.args([
					"actool",
					&icon_source,
					"--compile",
					&gen_dir,
					"--output-format",
					"human-readable-text",
					"--notices",
					"--warnings",
					"--errors",
					"--output-partial-info-plist",
					&format!("{}/partial.plist", gen_dir),
					"--app-icon",
					"Spacedrive",
					"--include-all-app-icons",
					"--enable-on-demand-resources",
					"NO",
					"--development-region",
					"en",
					"--target-device",
					"mac",
					"--minimum-deployment-target",
					"11.0",
					"--platform",
					"macosx",
				])
				.output()
				.expect("Failed to execute actool");

			if !output.status.success() {
				eprintln!("actool failed: {}", String::from_utf8_lossy(&output.stderr));
			} else {
				println!("Successfully compiled Spacedrive.icon to Assets.car");
			}
		}

		// Ensure macOS finds Swift runtime dylibs in dyld cache (@rpath/libswiftCore.dylib)
		println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
	}

	// Create target-suffixed daemon binary for Tauri bundler
	// Tauri's externalBin expects binaries with target triple suffix
	let target_triple = std::env::var("TARGET").expect("TARGET not set");

	// Expose target triple to runtime code for daemon binary resolution
	println!("cargo:rustc-env=SD_TARGET_TRIPLE={}", target_triple);
	let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
	let workspace_dir = std::env::var("CARGO_WORKSPACE_DIR")
		.or_else(|_| std::env::var("CARGO_MANIFEST_DIR").map(|d| format!("{}/../../..", d)))
		.expect("Could not find workspace directory");

	let exe_ext = if target_triple.contains("windows") {
		".exe"
	} else {
		""
	};

	for source_profile in [profile.as_str(), "release"] {
		let daemon_source = format!(
			"{}/target/{}/sd-daemon{}",
			workspace_dir, source_profile, exe_ext
		);
		let daemon_target = format!(
			"{}/target/{}/sd-daemon-{}{}",
			workspace_dir, source_profile, target_triple, exe_ext
		);

		if std::path::Path::new(&daemon_source).exists() {
			let _ = std::fs::remove_file(&daemon_target);

			if let Err(e) = std::fs::copy(&daemon_source, &daemon_target) {
				eprintln!("Warning: Failed to copy daemon: {}", e);
			}
		} else if !std::path::Path::new(&daemon_target).exists() {
			// When running cargo clippy/check directly without pre-building the daemon binary,
			// provide a placeholder so tauri_build::build() externalBin validation succeeds.
			// When bundling with tauri:build, beforeBuildCommand builds the real daemon binary first.
			if let Some(parent) = std::path::Path::new(&daemon_target).parent() {
				let _ = std::fs::create_dir_all(parent);
			}
			let _ = std::fs::write(&daemon_target, b"");
			#[cfg(unix)]
			{
				use std::os::unix::fs::PermissionsExt;
				let _ = std::fs::set_permissions(
					&daemon_target,
					std::fs::Permissions::from_mode(0o755),
				);
			}
		}
	}

	// Ensure frontendDist directory exists for tauri::generate_context!() macro
	let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
	let dist_dir = std::path::Path::new(&manifest_dir).join("../dist");
	if !dist_dir.exists() {
		let _ = std::fs::create_dir_all(&dist_dir);
		let index_html = dist_dir.join("index.html");
		if !index_html.exists() {
			let _ = std::fs::write(
				&index_html,
				b"<!DOCTYPE html><html><body>Placeholder</body></html>",
			);
		}
	}

	tauri_build::build()
}
