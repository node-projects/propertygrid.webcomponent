import type { IProperty, ITypeInfo } from './PropertyGrid.js';

export interface ICollectionOptions {
    item?: IProperty;
    createItem?: () => unknown | Promise<unknown>;
}

export type CollectionValue = unknown[] | Record<string, unknown>;
export type TypeResolver = (object: unknown, type: string) => Promise<ITypeInfo | null | undefined>;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Deliberately not a serializer: validate the complete graph before sharing a draft. */
export function cloneCollectionValue<T>(value: T): T {
    const copies = new Map<object, object>();
    const visiting = new Set<object>();
    const clone = (current: unknown): unknown => {
        if (current === null || current === undefined || typeof current === 'string' || typeof current === 'boolean')
            return current;
        if (typeof current === 'number' && Number.isFinite(current))
            return current;
        if (typeof current !== 'object' || (!Array.isArray(current) && !isRecord(current)))
            throw new Error('Only finite primitives, plain records and arrays are supported. Use a replacement editor for this value.');
        if (visiting.has(current))
            throw new Error('Cyclic values are not supported. Use a replacement editor.');
        if (copies.has(current))
            return copies.get(current);
        if (Object.getOwnPropertySymbols(current).length)
            throw new Error('Symbol keys are not supported. Use a replacement editor.');
        const result = Array.isArray(current) ? new Array(current.length) : Object.create(Object.getPrototypeOf(current));
        copies.set(current, result);
        visiting.add(current);
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(current))) {
            if (!('value' in descriptor))
                throw new Error('Accessor properties are not supported. Use a replacement editor.');
            if (!descriptor.enumerable) {
                if (Array.isArray(current) && key === 'length') continue;
                throw new Error('Nonenumerable properties are not supported. Use a replacement editor.');
            }
            defineKey(result, key, clone(descriptor.value));
        }
        visiting.delete(current);
        return result;
    };
    return clone(value) as T;
}

export function defineKey(record: object, key: string, value: unknown): void {
    Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}

export function assertCollection(value: unknown, type: string): asserts value is CollectionValue {
    if (type === 'array' ? !Array.isArray(value) : !isRecord(value))
        throw new Error(type === 'array' ? 'Expected an array.' : 'Expected a plain string-keyed dictionary.');
}

export function inferProperty(value: unknown): IProperty {
    if (Array.isArray(value)) return { type: 'array' };
    if (isRecord(value)) return { type: 'object' };
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return { type: typeof value };
    return { type: 'any' };
}

export async function createDefault(property: IProperty | undefined, resolve: TypeResolver, active = new Set<string>()): Promise<unknown> {
    if (!property) return null;
    if (property.defaultValue !== undefined) return cloneCollectionValue(property.defaultValue);
    switch (property.type) {
        case 'string': return '';
        case 'number': return 0;
        case 'boolean': return false;
        case 'color': return '#000000';
        case 'enum': {
            if (!property.values?.length) throw new Error('Enum items require values.');
            return cloneCollectionValue(property.values[0]);
        }
        case 'array': return [];
        case 'dictionary': return {};
        case 'any': case undefined: return null;
        case 'object': return {};
        default: {
            if (active.has(property.type)) throw new Error(`Recursive defaults for type "${property.type}" require a factory.`);
            const info = await resolve(null, property.type);
            if (!info) throw new Error(`Unknown item type "${property.type}".`);
            const next = new Set(active).add(property.type);
            const record = {};
            for (const field of info.properties ?? []) {
                assertFieldName(field.name);
                defineKey(record, field.name, field.nullable && field.defaultValue === undefined ? null : await createDefault(field, resolve, next));
            }
            return record;
        }
    }
}

export function assertFieldName(name: string): void {
    if (!name || name.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(name))
        throw new Error(`Object field "${name ?? ''}" is not supported by path-based grids. Use a dictionary or a replacement editor.`);
}

/** Build a private schema for each draft; never borrow a parent's custom editor closures. */
export async function draftSchema(property: IProperty, value: unknown, resolve: TypeResolver): Promise<{ root: ITypeInfo; types: Map<string, ITypeInfo>; objects: Map<string, IProperty> }> {
    const types = new Map<string, ITypeInfo>();
    const objects = new Map<string, IProperty>();
    const activeValues = new Set<object>();
    let sequence = 0;
    const describe = async (metadata: IProperty, current: unknown): Promise<IProperty> => {
        const p = { ...metadata, type: metadata.type ?? inferProperty(current).type };
        if (p.type === 'array' || p.type === 'dictionary') return p;
        let info: ITypeInfo;
        const builtins = ['any', 'string', 'number', 'boolean', 'color', 'enum'];
        if (builtins.includes(p.type)) {
            if (p.type === 'enum' && !p.values?.length) throw new Error('Enum items require values.');
            if (p.type === 'enum' && p.values.some(value => !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))))
                throw new Error('Enum items require string, finite number or boolean values.');
            return p;
        }
        const name = `CollectionDraft${++sequence}`;
        // Nullable object boundaries are leaves when absent. Never expand a
        // recursive schema past null, or materialize an untouched missing parent.
        if (current == null) {
            if (p.nullable) {
                if (p.type !== 'object' && !await resolve(current, p.type)) throw new Error(`Unknown item type "${p.type}".`);
                objects.set(name, p);
                return { ...p, type: name };
            }
            throw new Error('Object items must be plain records; enable nullable objects explicitly.');
        }
        if (!isRecord(current)) throw new Error('Object items must be plain records.');
        if (activeValues.has(current)) throw new Error('Cyclic values are not supported. Use a replacement editor.');
        activeValues.add(current);
        if (p.type === 'object' || !p.type) {
            info = { properties: Object.keys(current).map(name => ({ name, ...inferProperty(current[name]) })) };
        } else {
            info = await resolve(current, p.type);
            if (!info) throw new Error(`Unknown item type "${p.type}".`);
        }
        if (p.nullable) objects.set(name, p);
        const generated: ITypeInfo = { name, properties: [] };
        types.set(name, generated);
        for (const field of info.properties ?? []) {
            assertFieldName(field.name);
            generated.properties.push(await describe(field, isRecord(current) ? current[field.name] : undefined));
        }
        activeValues.delete(current);
        return { ...p, type: name };
    };
    const item = await describe({ ...property, name: 'value' }, value);
    return { root: { name: 'CollectionItem', properties: [item] }, types, objects };
}
