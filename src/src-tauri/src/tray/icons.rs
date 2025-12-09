use tauri::image::Image;

pub struct ThemeIcons {
    pub tray: Image<'static>,
    pub play: Image<'static>,
    pub stop: Image<'static>,
    pub power: Image<'static>,
    pub red: Image<'static>,
    pub green: Image<'static>,
    pub cog: Image<'static>,
    pub cpu: Image<'static>,
    pub file_clock: Image<'static>,
    pub trash: Image<'static>,
    pub download: Image<'static>,
    pub hard_drive: Image<'static>,
}

impl ThemeIcons {
    pub fn load(is_dark: bool) -> Self {
        if is_dark {
            Self::load_dark()
        } else {
            Self::load_light()
        }
    }

    fn load_dark() -> Self {
        Self {
            tray: Image::from_bytes(include_bytes!("../../icons/dark/tray.png"))
                .expect("failed to load dark/tray.png"),
            play: Image::from_bytes(include_bytes!("../../icons/dark/play.png"))
                .expect("failed to load dark/play.png"),
            stop: Image::from_bytes(include_bytes!("../../icons/dark/square.png"))
                .expect("failed to load dark/square.png"),
            power: Image::from_bytes(include_bytes!("../../icons/dark/power.png"))
                .expect("failed to load dark/power.png"),
            red: Image::from_bytes(include_bytes!("../../icons/dark/red.png"))
                .expect("failed to load dark/red.png"),
            green: Image::from_bytes(include_bytes!("../../icons/dark/green.png"))
                .expect("failed to load dark/green.png"),
            cog: Image::from_bytes(include_bytes!("../../icons/dark/cog.png"))
                .expect("failed to load dark/cog.png"),
            cpu: Image::from_bytes(include_bytes!("../../icons/dark/cpu.png"))
                .expect("failed to load dark/cpu.png"),
            file_clock: Image::from_bytes(include_bytes!("../../icons/dark/file-clock.png"))
                .expect("failed to load dark/file-clock.png"),
            trash: Image::from_bytes(include_bytes!("../../icons/dark/trash.png"))
                .expect("failed to load dark/trash.png"),
            download: Image::from_bytes(include_bytes!("../../icons/dark/download.png"))
                .expect("failed to load dark/download.png"),
            hard_drive: Image::from_bytes(include_bytes!("../../icons/dark/hard-drive.png"))
                .expect("failed to load dark/hard-drive.png"),
        }
    }

    fn load_light() -> Self {
        Self {
            tray: Image::from_bytes(include_bytes!("../../icons/light/tray.png"))
                .expect("failed to load light/tray.png"),
            play: Image::from_bytes(include_bytes!("../../icons/light/play.png"))
                .expect("failed to load light/play.png"),
            stop: Image::from_bytes(include_bytes!("../../icons/light/square.png"))
                .expect("failed to load light/square.png"),
            power: Image::from_bytes(include_bytes!("../../icons/light/power.png"))
                .expect("failed to load light/power.png"),
            red: Image::from_bytes(include_bytes!("../../icons/light/red.png"))
                .expect("failed to load light/red.png"),
            green: Image::from_bytes(include_bytes!("../../icons/light/green.png"))
                .expect("failed to load light/green.png"),
            cog: Image::from_bytes(include_bytes!("../../icons/light/cog.png"))
                .expect("failed to load light/cog.png"),
            cpu: Image::from_bytes(include_bytes!("../../icons/light/cpu.png"))
                .expect("failed to load light/cpu.png"),
            file_clock: Image::from_bytes(include_bytes!("../../icons/light/file-clock.png"))
                .expect("failed to load light/file-clock.png"),
            trash: Image::from_bytes(include_bytes!("../../icons/light/trash.png"))
                .expect("failed to load light/trash.png"),
            download: Image::from_bytes(include_bytes!("../../icons/light/download.png"))
                .expect("failed to load light/download.png"),
            hard_drive: Image::from_bytes(include_bytes!("../../icons/light/hard-drive.png"))
                .expect("failed to load light/hard-drive.png"),
        }
    }

    pub fn status_icon(&self, is_running: bool) -> Image<'static> {
        if is_running {
            self.green.clone()
        } else {
            self.red.clone()
        }
    }
}
