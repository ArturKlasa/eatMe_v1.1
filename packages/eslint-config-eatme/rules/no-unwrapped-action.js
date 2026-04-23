/** @type {import('eslint').Rule.RuleModule} */
export const noUnwrappedAction = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Server Action and Route Handler exports must be wrapped in an approved auth wrapper.',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          wrappers: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      notWrapped:
        'Export "{{name}}" must be wrapped in one of: {{wrappers}}. Got: {{got}}.',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const wrappers = options.wrappers ?? [
      'withAuth',
      'withAdminAuth',
      'withPublic',
      'withAuthRoute',
      'withAdminAuthRoute',
      'withPublicRoute',
    ];

    function getCalleeName(node) {
      if (!node) return null;
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'Identifier') return callee.name;
        if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          return callee.property.name;
        }
      }
      return null;
    }

    function checkExport(exportedName, initNode, reportNode) {
      const calleeName = getCalleeName(initNode);
      if (!wrappers.includes(calleeName)) {
        context.report({
          node: reportNode,
          messageId: 'notWrapped',
          data: {
            name: exportedName,
            wrappers: wrappers.join(', '),
            got: calleeName ?? (initNode ? initNode.type : 'none'),
          },
        });
      }
    }

    return {
      ExportNamedDeclaration(node) {
        // export const foo = withAuth(...)
        if (node.declaration) {
          const decl = node.declaration;

          if (decl.type === 'VariableDeclaration') {
            for (const declarator of decl.declarations) {
              if (declarator.id.type !== 'Identifier') continue;
              checkExport(declarator.id.name, declarator.init, declarator);
            }
            return;
          }

          // export async function POST() {...} — always fails
          if (decl.type === 'FunctionDeclaration' || decl.type === 'TSDeclareFunction') {
            const name = decl.id ? decl.id.name : 'unknown';
            context.report({
              node: decl,
              messageId: 'notWrapped',
              data: {
                name,
                wrappers: wrappers.join(', '),
                got: 'FunctionDeclaration',
              },
            });
            return;
          }

          // export class ... — always fails
          if (decl.type === 'ClassDeclaration') {
            const name = decl.id ? decl.id.name : 'unknown';
            context.report({
              node: decl,
              messageId: 'notWrapped',
              data: {
                name,
                wrappers: wrappers.join(', '),
                got: 'ClassDeclaration',
              },
            });
            return;
          }
        }

        // export { foo } from './other' — we can't check the source, allow
        // export { foo as bar } — local specifiers referencing module-scope variables
        // We don't traverse into re-exports for now.
      },
    };
  },
};
