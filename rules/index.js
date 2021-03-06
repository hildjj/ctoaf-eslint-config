// eslint-disable hildjj/sort-rules
'use strict'
const {Linter} = require('eslint')
const linter = new Linter()
const rules = linter.getRules()

function getIndent(node, src) {
  const [tok] = src.getTokens(node)
  return src.text.slice(tok.range[0] - tok.loc.start.column, tok.range[0])
}
const meta = {
  type: 'layout',
  fixable: 'code',
  docs: {
    description: 'Sort eslint rules',
    category: 'Stylistic Issues',
    recommended: false,
    url: 'http//example.com'
  }
}

module.exports = {
  rules: {
    'sort-rules': {
      meta,
      create(context) {
        const src = context.getSourceCode()
        return {
          'ObjectExpression[parent.key.name="rules"]': node => {
            const comments = src.getCommentsInside(node)
            const lines = comments.reduce((t, c) => {
              const match = c.value.match(/.*\[([^\]]+)\].*/)
              if (match) {
                t.push({
                  name: match[1],
                  line: c.loc.start.line,
                  range: c.range,
                  rules: []
                })
              }
              return t
            }, [])

            for (const p of node.properties) {
              const key = p.key.name || p.key.value
              const kr = rules.get(key)
              if (!kr) {
                continue
              }
              const section = kr.meta.docs.category
              if (!section) {
                continue
              }
              const i = lines.findIndex(({name}) => name === section)
              if (i === -1) {
                context.report({
                  message: 'No section found: "{{ section }}" for {{ key }}',
                  node: p.key,
                  data: {
                    key,
                    section
                  },
                  fix(fixer) {
                    const slug = section.replace(/\s+/g, '-').toLowerCase()
                    return fixer.insertTextBefore(p, `\
// [${section}](https://eslint.org/docs/rules/#${slug})
${getIndent(p.key, src)}`)
                  }
                })
                continue
              }
              const keyLine = p.key.loc.start.line
              const last = lines.reduce(
                (t, {line}, ci) => ((keyLine >= line) ? ci : t),
                -1
              )
              if (last === -1) {
                context.report({
                  message: '{{ key }} before any section',
                  node: p.key,
                  data: {
                    key
                  },
                  fix(fixer) {
                    const {range} = p
                    const tokAfter = src.getTokenAfter(p)
                    if (tokAfter && (tokAfter.value === ',')) {
                      // eslint-disable-next-line prefer-destructuring
                      range[1] = tokAfter.range[1]
                    }
                    range[0] -= (p.loc.start.column + 1) // newline
                    const orig = src.text.slice(...range)
                    return [
                      fixer.removeRange(range),
                      fixer.insertTextAfterRange(lines[i].range, orig)
                    ]
                  }
                })
                continue
              }
              if (last !== i) {
                context.report({
                  message: '{{ key }} should be in section: "{{ section }}", ' +
                    'but found in "{{ found }}"',
                  node: p.key,
                  data: {
                    key,
                    section,
                    found: lines[last].name
                  },
                  fix(fixer) {
                    const {range} = p
                    const tokAfter = src.getTokenAfter(p)
                    if (tokAfter && (tokAfter.value === ',')) {
                      // eslint-disable-next-line prefer-destructuring
                      range[1] = tokAfter.range[1]
                    }
                    range[0] -= (p.loc.start.column + 1) // newline
                    const orig = src.text.slice(...range)
                    return [
                      fixer.removeRange(range),
                      fixer.insertTextAfterRange(lines[i].range, orig)
                    ]
                  }
                })
                continue
              }
              lines[i].rules.push(p)
            }

            for (const comment of lines) {
              let prev = ''
              for (const p of comment.rules) {
                const key = p.key.name || p.key.value
                if (key.localeCompare(prev) !== 1) {
                  context.report({
                    message: '{{ key }} out of order',
                    node: p.key,
                    data: {
                      key
                    },
                  })
                }
                prev = key
              }
            }
          }
        }
      }
    }
  }
}
