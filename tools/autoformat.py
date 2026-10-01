#!/usr/bin/env python3
"""Normalise key order in OpenAPI YAML files.

Works on the bundled specification as well as on single source files
(schema or parameter files under src/components/):

- root keys and components follow ROOT_ORDER / COMPONENT_ORDER
- schema keys follow SCHEMA_ORDER, `required` is sorted alphabetically and
  properties are listed required-first, each group alphabetically
- parameter keys follow PARAMETER_ORDER
- flow-style sequences/mappings are converted to block style

Usage: python3 tools/autoformat.py <file.yaml> [more.yaml ...]
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

ROOT_ORDER = ["openapi", "info", "servers", "externalDocs", "tags", "security", "paths", "components"]
COMPONENT_ORDER = ["schemas", "responses", "parameters", "headers", "securitySchemes"]
SCHEMA_ORDER = [
    "title", "description", "$ref", "type", "format", "required", "properties", "items",
    "enum", "minimum", "minLength", "maximum", "maxLength", "pattern", "example", "examples",
]
PARAMETER_ORDER = ["in", "name", "description", "required", "schema", "example", "examples"]

SCHEMA_KEYS = {"$ref", "type", "properties", "required", "enum", "allOf", "oneOf", "anyOf", "items"}
SUBSCHEMA_LISTS = ("allOf", "oneOf", "anyOf")

yaml = YAML()
yaml.preserve_quotes = True
yaml.width = 170
yaml.indent(mapping=2, sequence=4, offset=2)


def reorder(node: CommentedMap, order: list[str], rest: list[str] | None = None) -> CommentedMap:
    """Return a copy of `node` with keys in `order` first, then `rest` (default: original order)."""
    keys = [k for k in order if k in node]
    keys += rest if rest is not None else [k for k in node if k not in keys]
    out = CommentedMap()
    for key in keys:
        out[key] = node[key]
        if key in node.ca.items:
            out.ca.items[key] = node.ca.items[key]
    out.ca.comment = node.ca.comment
    return out


def to_block_style(node: Any) -> None:
    if isinstance(node, (CommentedMap, CommentedSeq)):
        node.fa.set_block_style()
        for child in node.values() if isinstance(node, CommentedMap) else node:
            to_block_style(child)


def format_schema(schema: Any) -> Any:
    if not isinstance(schema, CommentedMap):
        return schema
    if "$ref" in schema and len(schema) == 1:
        return schema

    if isinstance(schema.get("required"), list):
        schema["required"] = CommentedSeq(sorted(schema["required"]))
    schema = reorder(schema, SCHEMA_ORDER)

    props = schema.get("properties")
    if isinstance(props, CommentedMap):
        required = set(schema.get("required") or [])
        ordered = sorted(k for k in props if k in required) + sorted(k for k in props if k not in required)
        props = reorder(props, [], ordered)
        for name in props:
            props[name] = format_schema(props[name])
        schema["properties"] = props

    if "items" in schema:
        schema["items"] = format_schema(schema["items"])
    if isinstance(schema.get("additionalProperties"), CommentedMap):
        schema["additionalProperties"] = format_schema(schema["additionalProperties"])
    for key in SUBSCHEMA_LISTS:
        if isinstance(schema.get(key), list):
            for i, sub in enumerate(schema[key]):
                schema[key][i] = format_schema(sub)
    return schema


def format_parameter(param: CommentedMap) -> CommentedMap:
    param = reorder(param, PARAMETER_ORDER)
    if "schema" in param:
        param["schema"] = format_schema(param["schema"])
    return param


def is_parameter(node: Any) -> bool:
    return isinstance(node, CommentedMap) and "in" in node and "name" in node


def walk(node: Any) -> Any:
    """Format every schema and parameter reachable from `node`."""
    if isinstance(node, CommentedMap):
        for key in list(node):
            value = node[key]
            if key == "schema":
                node[key] = format_schema(value)
            elif key == "schemas" and isinstance(value, CommentedMap):
                for name in value:
                    value[name] = format_schema(value[name])
            elif is_parameter(value):
                node[key] = format_parameter(value)
            else:
                node[key] = walk(value)
    elif isinstance(node, list):
        for i, item in enumerate(node):
            node[i] = format_parameter(item) if is_parameter(item) else walk(item)
    return node


def format_document(doc: CommentedMap) -> CommentedMap:
    if "openapi" in doc:
        doc = reorder(doc, ROOT_ORDER)
        if isinstance(doc.get("components"), CommentedMap):
            doc["components"] = reorder(doc["components"], COMPONENT_ORDER)
        return walk(doc)
    if is_parameter(doc):
        return format_parameter(doc)
    if SCHEMA_KEYS & set(doc):
        return format_schema(doc)
    return walk(doc)


def main(files: list[str]) -> int:
    if not files:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 1
    for name in files:
        path = Path(name)
        doc = yaml.load(path.read_text(encoding="utf-8"))
        if not isinstance(doc, CommentedMap):
            print(f"skipped (not a mapping): {path}", file=sys.stderr)
            continue
        doc = format_document(doc)
        to_block_style(doc)
        with path.open("w", encoding="utf-8") as fh:
            yaml.dump(doc, fh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
