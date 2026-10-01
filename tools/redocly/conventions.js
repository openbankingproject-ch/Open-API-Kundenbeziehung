// Redocly plugin enforcing the naming and structure conventions of this API.
// Registered in redocly.yaml; rules are referenced as `conventions/<rule-name>`.

const CASING = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  'Train-Case': /^[A-Z][a-zA-Z0-9]*(-[A-Z][a-zA-Z0-9]*)*$/,
};

const isCase = (value, casing) => typeof value === 'string' && CASING[casing].test(value);

// Reports keys of `node` that are missing from or out of the expected `order`.
function checkKeyOrder(node, order, { report, location }, { what, requireAll }) {
  const present = Object.keys(node).filter((key) => order.includes(key));
  const expected = order.filter((key) => present.includes(key));

  if (requireAll) {
    for (const key of order.filter((key) => !present.includes(key))) {
      report({ message: `\`${key}\` is missing in ${what}.`, location: location.key() });
    }
  }

  const misplaced = present.findIndex((key, index) => key !== expected[index]);
  if (misplaced !== -1) {
    report({
      message: `Keys in ${what} must be ordered as: ${expected.join(', ')}.`,
      location: location.child([present[misplaced]]).key(),
    });
  }
}

const DEFAULT_ROOT_ORDER = ['openapi', 'info', 'servers', 'externalDocs', 'tags', 'security', 'paths', 'components'];
const DEFAULT_COMPONENT_ORDER = ['schemas', 'responses', 'parameters', 'headers', 'securitySchemes'];

function rootOrder(options) {
  const order = options.order || DEFAULT_ROOT_ORDER;
  return {
    Root: {
      enter(root, ctx) {
        checkKeyOrder(root, order, ctx, { what: 'the root object', requireAll: true });
      },
    },
  };
}

function componentOrder(options) {
  const order = options.order || DEFAULT_COMPONENT_ORDER;
  return {
    Components: {
      enter(components, ctx) {
        checkKeyOrder(components, order, ctx, { what: 'components', requireAll: false });
      },
    },
  };
}

function schemaNameCasing() {
  return {
    NamedSchemas: {
      enter(schemas, { report, location }) {
        for (const name of Object.keys(schemas)) {
          if (!isCase(name, 'PascalCase')) {
            report({ message: `Schema name \`${name}\` must use PascalCase.`, location: location.child([name]).key() });
          }
        }
      },
    },
  };
}

function schemaDescription() {
  const endsCorrectly = (text) => text.endsWith('.') || text.includes('\n');
  return {
    NamedSchemas: {
      enter(schemas, { report, location }) {
        for (const [name, schema] of Object.entries(schemas)) {
          if (!schema.description) {
            report({ message: `Schema \`${name}\` must have a description.`, location: location.child([name]).key() });
          }
          for (const [prop, propSchema] of Object.entries(schema.properties || {})) {
            if (propSchema.$ref !== undefined) continue;
            const propLocation = location.child([name, 'properties', prop]);
            if (!propSchema.description) {
              report({ message: `Property \`${prop}\` must have a description.`, location: propLocation.key() });
            } else if (!endsCorrectly(propSchema.description)) {
              report({ message: 'Description must end with a full stop.', location: propLocation.child(['description']) });
            }
          }
        }
      },
    },
  };
}

function patternAnchors() {
  return {
    Schema: {
      enter(schema, { report, location }) {
        if (typeof schema.pattern === 'string' && !/^\^.*\$$/.test(schema.pattern)) {
          report({
            message: 'Pattern must start with `^` and end with `$` to enforce an exact match.',
            location: location.child(['pattern']),
          });
        }
      },
    },
  };
}

// Path parameters: camelCase identifiers ending in `Id`.
// Query parameters: snake_case. Header parameters: Train-Case (custom headers start with `X-`).
function parameterNaming() {
  return {
    Parameter: {
      enter(param, { report, location }) {
        const nameLocation = location.child(['name']);
        if (param.in === 'path') {
          if (!isCase(param.name, 'camelCase')) {
            report({ message: `Path parameter \`${param.name}\` must use camelCase.`, location: nameLocation });
          }
          if (!String(param.name).endsWith('Id')) {
            report({ message: `Path parameter \`${param.name}\` must be an identifier ending in \`Id\`.`, location: nameLocation });
          }
        } else if (param.in === 'query' && !isCase(param.name, 'snake_case')) {
          report({ message: `Query parameter \`${param.name}\` must use snake_case.`, location: nameLocation });
        } else if (param.in === 'header' && !isCase(param.name, 'Train-Case')) {
          report({ message: `Header parameter \`${param.name}\` must use Train-Case.`, location: nameLocation });
        }
      },
    },
  };
}

function tagCasing() {
  return {
    Tag: {
      enter(tag, { report, location }) {
        if (!isCase(tag.name, 'kebab-case')) {
          report({ message: `Tag \`${tag.name}\` must use kebab-case.`, location: location.child(['name']) });
        }
      },
    },
  };
}

function infoContent(options) {
  const license = options.license || {};
  return {
    Info: {
      enter(info, { report, location }) {
        if (!/^\d+\.\d+\.\d+$/.test(info.version || '')) {
          report({ message: 'Version must use semantic versioning (major.minor.patch).', location: location.child(['version']) });
        }
        if (license.name && info.license?.name !== license.name) {
          report({ message: `License name must be \`${license.name}\`.`, location: location.child(['license']) });
        }
        if (license.url && info.license?.url !== license.url) {
          report({ message: `License url must be \`${license.url}\`.`, location: location.child(['license']) });
        }
      },
    },
  };
}

export default function conventionsPlugin() {
  return {
    id: 'conventions',
    rules: {
      oas3: {
        'root-order': rootOrder,
        'component-order': componentOrder,
        'schema-name-casing': schemaNameCasing,
        'schema-description': schemaDescription,
        'pattern-anchors': patternAnchors,
        'parameter-naming': parameterNaming,
        'tag-casing': tagCasing,
        'info-content': infoContent,
      },
    },
  };
}
