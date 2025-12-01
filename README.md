# FlmCompagnon

FlmCompagnon is a modern GUI designed to accompany and manage the **FLM** project. It offers a smooth user experience to interact with your local AI models, monitor the server, and manage your configurations.

## Features

* **Models**: Model manager (download, delete, inspect details).
* **Server**: Configuration and management of the FLM server instance.
* **Settings**: Application customization.
* **About**: View application version, hardware information, and check for updates.
* **Multilingual** Interface management in English and French.
* **Theme** Management of light and dark themes.

## To do

* [X] Clean code and optimisation
* [ ] Fix the server management design for consistency
* [X] Add a version check for the companion application (+ changelog)
* [X] Add caching for the list of models, CPU version, and RAM
* [X] Force an update of the model list on the server configuration side when models are modified (DLL, delete)
* [ ] Add menus to the notification area icon (server management, models)
* [X] Complete the translation of all texts for multilingual support
* [X] Flm update 0.9.21 → add the option to launch the server without a model using ASR for Whisper

## FLM Dependency

This project is a frontend/GUI and strongly depends on the **FLM** project to function. Ensure FLM is installed and configured.

🔗 **[View FLM project on GitHub](https://github.com/FastFlowLM/FastFlowLM)**

## Contribution

This project is open-source and open to contributions! Feel free to propose improvements via **Pull Requests** or report issues.

## Installation and Development

To run the project in development mode, you will need [Rust](https://www.rust-lang.org/) and [Node.js](https://nodejs.org/).

1. Install JavaScript dependencies:

    ```bash
    npm install
    ```

2. Run the application in development mode:

    ```bash
    npm run tauri dev
    ```

To build the project in release mode, you will need [Rust](https://www.rust-lang.org/) and [Node.js](https://nodejs.org/).

1. Install JavaScript dependencies:

    ```bash
    npm install
    ```

2. Build the application in release mode:

    ```bash
    npm run tauri build
    ```
