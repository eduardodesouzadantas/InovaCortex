import { HELP_CONTENT } from "./help-content"

export function getHelp(key: keyof typeof HELP_CONTENT) {
    return HELP_CONTENT[key]
}
