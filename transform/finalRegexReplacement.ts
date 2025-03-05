export function applyFinalReplacements(code) {
    return code.replace(/^.*?\.store\./, '');
}
