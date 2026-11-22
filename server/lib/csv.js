// Minimal RFC 4180 CSV reader/writer (quoted fields, commas, newlines inside quotes).

function parse(text) {
    const rows = []
    let row = []
    let field = ''
    let quoted = false
    const s = String(text || '').replace(/^﻿/, '')
    for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (quoted) {
            if (c === '"' && s[i + 1] === '"') { field += '"'; i++ }
            else if (c === '"') quoted = false
            else field += c
        } else if (c === '"') quoted = true
        else if (c === ',') { row.push(field); field = '' }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i++
            row.push(field); field = ''
            if (row.some((v) => v !== '')) rows.push(row)
            row = []
        } else field += c
    }
    row.push(field)
    if (row.some((v) => v !== '')) rows.push(row)

    const [header = [], ...data] = rows
    const keys = header.map((h) => h.trim())
    return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const cell = (v) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function stringify(rows, columns) {
    return [columns.map(cell).join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n')
}

module.exports = { parse, stringify }
