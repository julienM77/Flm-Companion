/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GIT_PROJECT_COMPANION: string
    readonly VITE_GIT_PROJECT_FLM?: string
    readonly VITE_AMD_URL?: string
    readonly NODE_ENV?: string
    readonly MODE?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}