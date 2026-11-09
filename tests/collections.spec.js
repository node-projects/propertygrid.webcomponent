import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    page.collectionErrors = [];
    page.on('pageerror', error => page.collectionErrors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(page.collectionErrors).toEqual([]); });

async function setup(page, configuration = {}) {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => import('/dist/index.js'));
    await page.evaluate(({ type = 'array', value = ['one', 'two'], item = { type: 'string' }, nullable = false, definitions = [] }) => {
        window.original = value;
        window.events = [];
        const grid = document.createElement('node-projects-property-grid');
        grid.id = 'collections';
        grid.noCategory = true;
        grid.typeName = 'Root';
        grid.typeDefinitions = [{ name: 'Root', properties: [{ name: 'entries', type, nullable, collection: item ? { item } : undefined }] }, ...definitions];
        grid.selectedObject = { entries: value };
        grid.propertyChanged.on(e => events.push(e));
        document.body.append(grid);
        window.grid = grid;
    }, configuration);
    await expect(page.locator('#collections [part~="collection-edit"]')).toBeVisible();
}

function outer(page) { return page.locator('#collections').locator('dialog[open]').first(); }
async function open(page) { await page.locator('#collections [part~="collection-edit"]').first().click(); await expect(outer(page)).toBeVisible(); }
async function valueInput(page, type = 'text') { const input = outer(page).locator(`[part~="collection-grid"] [part~="editor-${type}"]`).first(); await expect(input).toBeVisible(); return input; }
async function result(page) { return page.evaluate(() => ({ value: grid.selectedObject.entries, original, events: events.length })); }

test('compact leaf, pending input Apply, one replacement and latest value on reopen', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#collections [part~="collection-summary"]')).toHaveText('2 items');
    expect(await page.locator('#collections [part~="object-row"]').count()).toBe(0);
    await open(page);
    await (await valueInput(page)).fill('edited');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await result(page)).toEqual({ value: ['edited', 'two'], original: ['one', 'two'], events: 1 });
    expect(await page.evaluate(() => grid.selectedObject.entries !== original)).toBe(true);
    await open(page);
    await expect(await valueInput(page)).toHaveValue('edited');
});

test('selection flushes last input, reorder retains selection, boundaries and remove', async ({ page }) => {
    await setup(page);
    await open(page);
    await expect(outer(page).getByRole('button', { name: 'Move up' })).toBeDisabled();
    await (await valueInput(page)).fill('first');
    await outer(page).getByRole('listbox').selectOption({ index: 1 });
    await expect(await valueInput(page)).toHaveValue('two');
    await expect(outer(page).getByRole('button', { name: 'Move down' })).toBeDisabled();
    await outer(page).getByRole('button', { name: 'Move up' }).click();
    await expect(await valueInput(page)).toHaveValue('two');
    await outer(page).getByRole('button', { name: 'Remove', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['first']);
});

for (const cancel of ['Cancel', 'Escape']) test(`${cancel} discards isolated object edits and restores focus`, async ({ page }) => {
    await setup(page, { value: [{ title: 'before', child: { text: 'nested' } }], item: null });
    await open(page);
    await (await valueInput(page)).fill('after');
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await result(page)).toEqual({ value: [{ title: 'before', child: { text: 'nested' } }], original: [{ title: 'before', child: { text: 'nested' } }], events: 0 });
    await expect(page.locator('#collections [part~="collection-edit"]').first()).toBeFocused();
});

for (const kind of ['null', 'missing', 'empty']) test(`${kind} opens without initialization; empty Apply or Cancel is explicit`, async ({ page }) => {
    await setup(page, { value: kind === 'empty' ? [] : null, nullable: true });
    if (kind === 'missing') await page.evaluate(() => { delete grid.selectedObject.entries; });
    await open(page);
    expect((await result(page)).events).toBe(0);
    if (kind === 'null') await outer(page).getByLabel('Set to null').uncheck();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([]);
    expect((await result(page)).events).toBe(1);
});

test('nullable null toggle is in dialog and Cancel preserves undefined', async ({ page }) => {
    await setup(page, { nullable: true });
    expect(await page.locator('#collections [part~="nullable-editor"]').count()).toBe(0);
    await open(page);
    await outer(page).getByLabel('Set to null').check();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toBeNull();
    await page.evaluate(() => { delete grid.selectedObject.entries; });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => Object.hasOwn(grid.selectedObject, 'entries'))).toBe(false);
});

for (const [type, initial, edit, expected] of [['number', 3, '4.5', 4.5], ['boolean', false, true, true], ['enum', 'a', 'b', 'b'], ['color', '#123456', '#abcdef', '#abcdef']]) {
    test(`${type} edits stay typed and enum/color direct setters are transferred`, async ({ page }) => {
        await setup(page, { value: [initial], item: { type, values: ['a', 'b'] } });
        await open(page);
        if (type === 'enum') {
            const select = outer(page).locator('[part~="collection-grid"] select');
            await expect(select).toBeVisible();
            await select.selectOption(edit);
        } else {
            const input = await valueInput(page, type === 'boolean' ? 'checkbox' : type);
            if (type === 'boolean') await input.check(); else await input.fill(edit);
        }
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([expected]);
    });
}

test('invalid finite number blocks blur, selection and Apply; Enter normalized locally', async ({ page }) => {
    await setup(page, { value: [3, 4], item: { type: 'number' } });
    await open(page);
    const input = await valueInput(page, 'number');
    await input.fill('');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('finite number');
    expect((await result(page)).events).toBe(0);
    await input.fill('9');
    await input.press('Enter');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([9, 4]);
});

test('safe dictionary keys including dots, Unicode, empty and prototype names', async ({ page }) => {
    await setup(page, { type: 'dictionary', value: {}, item: { type: 'string' } });
    await page.evaluate(() => {
        const value = Object.create(null);
        for (const key of ['a.b', '', '__proto__', 'constructor', 'prototype', '雪']) Object.defineProperty(value, key, { value: key, enumerable: true, writable: true, configurable: true });
        grid.selectedObject.entries = value;
        original = value;
    });
    await open(page);
    await (await valueInput(page)).fill('dot edited');
    await outer(page).getByRole('listbox').selectOption({ index: 2 });
    await (await valueInput(page)).fill('safe');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => ({ dot: grid.selectedObject.entries['a.b'], proto: grid.selectedObject.entries.__proto__, own: Object.hasOwn(grid.selectedObject.entries, '__proto__'), empty: grid.selectedObject.entries[''], polluted: Object.prototype.safe, original: original.__proto__ }))).toEqual({ dot: 'dot edited', proto: 'safe', own: true, empty: '', polluted: undefined, original: '__proto__' });
});

test('dictionary rename preserves insertion, duplicate blocks, empty key accepted', async ({ page }) => {
    await setup(page, { type: 'dictionary', value: { a: 'one', b: 'two' } });
    await open(page);
    await outer(page).getByLabel('Key', { exact: true }).fill('b');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('already exists');
    await outer(page).getByLabel('Key', { exact: true }).fill('');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual({ '': 'one', b: 'two' });
});

test('numeric dictionary rename follows entry despite own-key enumeration ordering', async ({ page }) => {
    await setup(page, { type: 'dictionary', value: { a: 'one', b: 'two' } });
    await open(page);
    await outer(page).getByRole('listbox').selectOption({ index: 1 });
    await outer(page).getByLabel('Key', { exact: true }).fill('0');
    await (await valueInput(page)).fill('renamed');
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual({ '0': 'renamed', a: 'one', key: '' });
});

test('pending dictionary rename followed by selection edits the requested next key', async ({ page }) => {
    await setup(page, { type: 'dictionary', value: { a: 'one', b: 'two', c: 'three' } });
    await open(page);
    await outer(page).getByLabel('Key', { exact: true }).fill('0');
    await outer(page).getByRole('listbox').selectOption('c');
    await (await valueInput(page)).fill('edited c');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual({ '0': 'one', b: 'two', c: 'edited c' });
});

test('sparse list holes can be selected and edited without changing original', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { original = new Array(2); original[1] = 'last'; grid.selectedObject.entries = original; });
    await open(page);
    await expect(outer(page).getByRole('listbox').locator('option')).toHaveCount(2);
    await (await valueInput(page)).fill('filled');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [grid.selectedObject.entries[0], Object.hasOwn(original, '0'), events.length])).toEqual(['filled', false, 1]);
});

test('disconnect with nested sessions closes descendants but not an independent sibling modal', async ({ page }) => {
    await setup(page, { value: [{ names: ['one'] }], item: null });
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    await page.evaluate(() => { window.sibling = document.createElement('dialog'); sibling.textContent = 'Independent'; document.body.append(sibling); sibling.showModal(); grid.remove(); });
    expect(await page.evaluate(() => [sibling.open, grid.shadowRoot.querySelectorAll('dialog[open]').length, events.length])).toEqual([true, 0, 0]);
});

test('nested collections native modal stack Apply into draft then parent Cancel', async ({ page }) => {
    await setup(page, { value: [{ names: ['one'] }], item: null });
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    const nested = page.locator('#collections dialog[open]').last();
    await expect(page.locator('#collections dialog[open]')).toHaveCount(2);
    await nested.locator('[part~="editor-text"]').fill('nested edit');
    await nested.getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).events).toBe(0);
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await result(page)).value).toEqual([{ names: ['one'] }]);
});

test('nested list of dictionary Apply composes without outer event leaks', async ({ page }) => {
    await setup(page, { value: [{ a: 2 }], item: { type: 'dictionary', collection: { item: { type: 'number' } } } });
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    const nested = page.locator('#collections dialog[open]').last();
    await nested.locator('input[type="number"]').fill('7');
    await nested.getByRole('button', { name: 'Apply', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await result(page)).toEqual({ value: [{ a: 7 }], original: [{ a: 2 }], events: 1 });
});

test('alias clone preserves shared records before and after Apply without sharing original', async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(() => { const record = { title: 'old' }; original = [record, record]; grid.selectedObject.entries = original; });
    await open(page);
    await (await valueInput(page)).fill('new');
    await outer(page).getByRole('listbox').selectOption({ index: 1 });
    await expect(await valueInput(page)).toHaveValue('new');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [grid.selectedObject.entries[0] === grid.selectedObject.entries[1], grid.selectedObject.entries[0] !== original[0], original[0].title, events.length])).toEqual([true, true, 'old', 1]);
});

test('nested collection replacement retains graph aliases on Apply', async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(() => { const list = ['old']; original = [{ names: list }, { names: list }]; grid.selectedObject.entries = original; });
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    const nested = page.locator('#collections dialog[open]').last();
    await nested.locator('[part~="editor-text"]').fill('new');
    await nested.getByRole('button', { name: 'Apply', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [grid.selectedObject.entries[0].names === grid.selectedObject.entries[1].names, grid.selectedObject.entries[1].names[0], original[0].names[0], events.length])).toEqual([true, 'new', 'old', 1]);
});

test('untyped null and explicit structured defaults are isolated; successful async factory', async ({ page }) => {
    await setup(page, { value: [], item: null });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(outer(page).locator('[part~="any-type-selector"]')).toHaveValue('null');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([null]);
    await page.evaluate(() => {
        window.defaultRecord = { title: 'default' };
        grid.typeDefinitions[0].properties[0].collection = { item: { type: 'object', defaultValue: defaultRecord } };
        grid.selectedObject.entries = [];
    });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await (await valueInput(page)).fill('changed');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => defaultRecord.title)).toBe('default');
    await page.evaluate(() => {
        grid.typeDefinitions[0].properties[0].collection = { item: { type: 'string' }, createItem: () => new Promise(resolve => window.finishFactory = resolve) };
        grid.selectedObject.entries = [];
    });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await page.evaluate(() => finishFactory('async'));
    await expect(await valueInput(page)).toHaveValue('async');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['async']);
});

for (const invalid of ['cycle', 'accessor', 'class', 'function', 'object field']) test(`unsupported ${invalid} shows an error dialog and never writes`, async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(invalid => {
        let value;
        if (invalid === 'cycle') { value = []; value.push(value); }
        if (invalid === 'accessor') { value = [{}]; Object.defineProperty(value[0], 'field', { enumerable: true, get() { throw new Error('getter must never run'); } }); }
        if (invalid === 'class') value = [new Date()];
        if (invalid === 'function') value = [() => {}];
        if (invalid === 'object field') value = [{ 'a.b': 'text' }];
        grid.selectedObject.entries = value;
    }, invalid);
    await open(page);
    await expect(outer(page).getByRole('alert')).not.toBeEmpty();
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    expect((await page.evaluate(() => events.length))).toBe(0);
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('named object typed defaults and factory precedence with cloned defaults', async ({ page }) => {
    await setup(page, { value: [], item: { type: 'Record' }, definitions: [{ name: 'Record', properties: [{ name: 'title', type: 'string', defaultValue: 'default' }, { name: 'count', type: 'number' }, { name: 'tags', type: 'array' }] }] });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(await valueInput(page)).toHaveValue('default');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ title: 'default', count: 0, tags: [] }]);
    await page.evaluate(() => {
        window.factoryValue = { title: 'factory', count: 2, tags: [] };
        grid.typeDefinitions[0].properties[0].collection.createItem = () => factoryValue;
    });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await (await valueInput(page)).fill('changed');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [factoryValue.title, grid.selectedObject.entries[1].title])).toEqual(['factory', 'changed']);
});

test('recursive defaults fail visibly and factory failures allow retry', async ({ page }) => {
    await setup(page, { value: [], item: { type: 'Recursive' }, definitions: [{ name: 'Recursive', properties: [{ name: 'child', type: 'Recursive' }] }] });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('Recursive defaults');
    await expect(outer(page).getByRole('button', { name: 'Add', exact: true })).toBeEnabled();
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => { const p = grid.typeDefinitions[0].properties[0]; p.collection.item = { type: 'string' }; p.collection.createItem = () => { throw new Error('factory failed'); }; });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('factory failed');
    expect((await result(page)).events).toBe(0);
});

test('async factory busy and cancellation ignores late completion', async ({ page }) => {
    await setup(page, { value: [] });
    await page.evaluate(() => { grid.typeDefinitions[0].properties[0].collection.createItem = () => new Promise(resolve => window.finishFactory = resolve); });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(outer(page)).toHaveAttribute('aria-busy', 'true');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => finishFactory('late'));
    await open(page);
    await expect(outer(page).getByRole('listbox').locator('option')).toHaveCount(0);
    expect((await result(page)).value).toEqual([]);
});

for (const action of ['selection', 'refresh', 'clear', 'disconnect', 'replacement']) test(`stale ${action} invalidates draft without obsolete writes`, async ({ page }) => {
    await setup(page);
    await open(page);
    await (await valueInput(page)).fill('obsolete');
    await page.evaluate(async action => {
        if (action === 'selection') grid.selectedObject = { entries: ['new'] };
        if (action === 'refresh') await grid.refresh();
        if (action === 'clear') grid.clear();
        if (action === 'disconnect') grid.remove();
        if (action === 'replacement') grid.selectedObject.entries = ['replacement'];
    }, action);
    if (action === 'replacement') await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('#collections dialog[open]')).toHaveCount(0);
    expect(await page.evaluate(() => [original, events.length])).toEqual([['one', 'two'], 0]);
});

test('layout changes preserve session and dialog is outside the virtual tree', async ({ page }) => {
    await setup(page);
    await open(page);
    await (await valueInput(page)).fill('retained');
    await page.evaluate(() => { grid.rowHeight = 32; grid.nameColumnRatio = .4; grid.showDescription = false; });
    expect(await outer(page).evaluate(dialog => dialog.parentNode === grid.shadowRoot && !dialog.closest('[part~="row"]'))).toBe(true);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value[0]).toBe('retained');
});

test('hook replacement via public setter and null fallback; hooks not copied into draft', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        window.hookCalls = 0;
        grid.getSpecialEditorForType = async (p, value, path) => {
            hookCalls++;
            if (p.type !== 'array') throw new Error('parent hook entered draft');
            const button = document.createElement('button'); button.textContent = 'Replace'; button.onclick = () => grid.setPropertyValue(path, ['replacement']); return button;
        };
        await grid.refresh();
    });
    await page.locator('#collections').getByRole('button', { name: 'Replace', exact: true }).click();
    expect((await result(page)).value).toEqual(['replacement']);
    await page.evaluate(async () => { grid.getSpecialEditorForType = async () => { hookCalls++; return null; }; await grid.refresh(); });
    await open(page);
    await valueInput(page);
    expect(await page.evaluate(() => hookCalls)).toBe(2);
});

test('preupgrade hook is preserved and stale async hook ignored', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => {
        window.calls = 0;
        const grid = document.createElement('node-projects-property-grid'); grid.id = 'collections';
        grid.typeName = 'Root'; grid.typeDefinitions = [{ name: 'Root', properties: [{ name: 'entries', type: 'array' }] }];
        grid.selectedObject = { entries: [] };
        grid.getSpecialEditorForType = async () => { calls++; const button = document.createElement('button'); button.textContent = 'Preupgrade'; return button; };
        document.body.append(grid); window.grid = grid;
    });
    await page.evaluate(() => import('/dist/index.js'));
    await expect(page.locator('#collections').getByRole('button', { name: 'Preupgrade' })).toBeVisible();
    expect(await page.evaluate(() => calls)).toBe(1);
    await page.evaluate(async () => { grid.getSpecialEditorForType = () => new Promise(resolve => window.finishHook = resolve); await grid.refresh(); });
    await expect.poll(() => page.evaluate(() => typeof finishHook)).toBe('function');
    await page.evaluate(async () => { grid.getSpecialEditorForType = null; grid.selectedObject = { entries: [] }; const button = document.createElement('button'); button.textContent = 'Obsolete'; finishHook(button); });
    await expect(page.locator('#collections [part~="collection-edit"]')).toBeVisible();
    await expect(page.locator('#collections').getByRole('button', { name: 'Obsolete' })).toHaveCount(0);
});

test('schema arrays/dictionaries/ref and inline object items preserve ordinary refs', async ({ page }) => {
    await setup(page);
    const metadata = await page.evaluate(async () => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        const schema = { definitions: { Root: { properties: {
            entries: { type: 'array', items: { $ref: '#/definitions/Record' } },
            dictionary: { type: 'object', additionalProperties: { type: 'number' } },
            inline: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } } },
            normal: { $ref: '#/definitions/Scalar' }
        } }, Record: { properties: { title: { type: 'string' } } }, Scalar: { type: 'string' } } };
        grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
        grid.selectedObject = { entries: [{ title: 'schema' }], dictionary: {}, inline: [] };
        return typeInfoFromJsonSchema(schema, {}, 'Root');
    });
    expect(metadata.properties[0].collection.item.type).toBe('Record');
    expect(metadata.properties[1].type).toBe('dictionary');
    expect(metadata.properties[3].type).toBe('string');
    await open(page);
    await expect(await valueInput(page)).toHaveValue('schema');
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('#collections [part~="collection-edit"]').nth(2).click();
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(await valueInput(page)).toHaveValue('');
});

for (const width of [320, 1280]) test(`themed dialog fits ${width}px, inherited tokens and instance sheets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await setup(page, { value: [{ title: 'themed' }], item: null });
    await page.evaluate(() => {
        grid.style.cssText = 'width:100%;height:300px;--pg-background:rgb(20,30,40);--pg-color:rgb(230,240,250);--pg-editor-background:rgb(30,40,50);--pg-editor-color:rgb(220,230,240);--pg-collection-radius:12px';
        const sheet = new CSSStyleSheet(); sheet.replaceSync('[part~="collection-title"] { letter-spacing: 1px; } [part~="editor-text"] { border-radius: 7px; }'); grid.additionalStyleSheets = [sheet];
    });
    await open(page);
    await expect(outer(page)).toHaveCSS('background-color', 'rgb(20, 30, 40)');
    await expect(outer(page)).toHaveCSS('border-radius', '12px');
    await expect(await valueInput(page)).toHaveCSS('border-radius', '7px');
    const bounds = await outer(page).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await outer(page).evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.screenshot({ path: `/private/var/folders/15/pnkxswbs2335j6w8xbwm8m3r4ptpbq/T/opencode/collections-${width}.png` });
});

test('standalone sample uses default appearance, edits a named object and switches replacement hook', async ({ page }) => {
    await page.goto('/sample/collections.html');
    const grid = page.locator('#grid');
    await expect(grid.locator('[part~="collection-edit"]')).toHaveCount(4);
    await expect(grid.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(grid.locator('[part="tree"]')).toHaveCSS('color', 'rgb(86, 83, 76)');
    expect(await grid.evaluate(e => e.rowHeight)).toBe(22);
    expect(await grid.evaluate(e => getComputedStyle(e).getPropertyValue('--pg-background'))).toBe('');
    await grid.locator('[part~="collection-edit"]').last().click();
    await expect(grid.locator('dialog[open]').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await grid.locator('dialog[open]').first().getByRole('button', { name: 'Add', exact: true }).click();
    await expect(grid.locator('dialog[open]').first().locator('[part~="editor-text"]')).toHaveValue('New record');
    await grid.locator('dialog[open]').first().getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('#events')).toHaveText('1 applied change events');
    await page.locator('#replacement').check();
    await expect(grid.getByRole('button', { name: 'Replace tags' })).toBeVisible();
    await grid.getByLabel('Tags separated by commas').fill('x, y');
    await grid.getByRole('button', { name: 'Replace tags' }).click();
    await expect(page.locator('#output')).toContainText('"x"');
});

for (const type of ['string', 'number']) {
    test(`nullable ${type} items preserve null and explicitly enable a value`, async ({ page }) => {
        await setup(page, { value: [null], item: { type, nullable: true } });
        await open(page);
        await expect(outer(page).locator('[part~="nullable-toggle"]')).not.toBeChecked();
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([null]);
        await open(page);
        await outer(page).locator('[part~="nullable-toggle"]').check();
        await (await valueInput(page, type === 'number' ? 'number' : 'text')).fill(type === 'number' ? '7.5' : 'enabled');
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([type === 'number' ? 7.5 : 'enabled']);
        await open(page);
        await outer(page).locator('[part~="nullable-toggle"]').uncheck();
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([null]);
    });
}

for (const missing of [false, true]) test(`nullable named child ${missing ? 'missing' : 'null'} is preserved until enabled`, async ({ page }) => {
    await setup(page, { value: [missing ? {} : { child: null }], item: { type: 'Parent' }, definitions: [
        { name: 'Parent', properties: [{ name: 'child', type: 'Child', nullable: true }] },
        { name: 'Child', properties: [{ name: 'title', type: 'string', defaultValue: 'created' }] }
    ] });
    await open(page);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([missing ? {} : { child: null }]);
    await open(page);
    await outer(page).getByLabel('Enable child', { exact: true }).check();
    await expect(await valueInput(page)).toHaveValue('created');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ child: { title: 'created' } }]);
    await open(page);
    await outer(page).getByLabel('Enable child', { exact: true }).uncheck();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ child: null }]);
});

test('finite nullable recursive values and defaults stop at null boundaries', async ({ page }) => {
    await setup(page, { value: [{ title: 'root', child: { title: 'leaf', child: null } }], item: { type: 'Node' }, definitions: [
        { name: 'Node', properties: [{ name: 'title', type: 'string' }, { name: 'child', type: 'Node', nullable: true }] }
    ] });
    await open(page);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ title: 'root', child: { title: 'leaf', child: null } }]);
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value[1]).toEqual({ title: '', child: null });
});

test('nonnullable named null item rejects without silently initializing', async ({ page }) => {
    await setup(page, { value: [null], item: { type: 'Child' }, definitions: [{ name: 'Child', properties: [{ name: 'title', type: 'string' }] }] });
    await open(page);
    await expect(outer(page).getByRole('alert')).toContainText('plain records');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    expect((await result(page)).value).toEqual([null]);
});

for (const order of [[0], [1], [0, 1], [1, 0]]) test(`alias sibling edits are last-edit-owned (${order.join(',')})`, async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(() => { const shared = { title: 'old' }; original = [{ left: shared, right: shared }]; grid.selectedObject.entries = original; });
    await open(page);
    const inputs = outer(page).locator('[part~="editor-text"]');
    await expect(inputs).toHaveCount(2);
    for (const index of order) await inputs.nth(index).fill(`edited ${index}`);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [grid.selectedObject.entries[0].left === grid.selectedObject.entries[0].right, grid.selectedObject.entries[0].left.title, original[0].left.title])).toEqual([true, `edited ${order.at(-1)}`, 'old']);
});

for (const kind of ['undefined', 'hole', 'missing field', 'unmatched enum', 'missing enum', 'default placeholder']) test(`untouched ${kind} retains value and own presence`, async ({ page }) => {
    const item = kind.includes('enum') ? { type: 'enum', values: ['a', 'b'] } : kind === 'missing field' ? { type: 'Record' } : kind === 'default placeholder' ? { type: 'number', defaultValue: 99 } : { type: 'any' };
    await setup(page, { item, definitions: [{ name: 'Record', properties: [{ name: 'optional', type: 'any' }] }] });
    await page.evaluate(kind => {
        original = kind === 'hole' ? new Array(2) : kind === 'missing field' ? [{}] : kind === 'unmatched enum' ? ['unmatched'] : [undefined];
        grid.selectedObject.entries = original;
    }, kind);
    await open(page);
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => {
        const next = grid.selectedObject.entries;
        return [next.length === original.length, Object.hasOwn(next, 0) === Object.hasOwn(original, 0), next[0] === original[0] || (JSON.stringify(next[0]) === JSON.stringify(original[0])), next[0] && Object.hasOwn(next[0], 'optional')];
    })).toEqual([true, true, true, kind === 'missing field' ? false : kind === 'unmatched enum' ? false : undefined]);
});

test('sparse move/remove/Add preserves holes and own undefined', async ({ page }) => {
    await setup(page, { item: { type: 'any' } });
    await page.evaluate(() => { original = new Array(3); original[1] = undefined; original[2] = 'last'; grid.selectedObject.entries = original; });
    await open(page);
    await outer(page).getByRole('button', { name: 'Move down' }).click();
    await outer(page).getByRole('button', { name: 'Remove', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [Object.hasOwn(grid.selectedObject.entries, 0), grid.selectedObject.entries[0], grid.selectedObject.entries[1], grid.selectedObject.entries[2], Object.hasOwn(original, 0)])).toEqual([true, undefined, 'last', null, false]);
});

test('explicit enum changes require a member instead of silently committing empty', async ({ page }) => {
    await setup(page, { value: ['outside'], item: { type: 'enum', values: ['a', 'b'] } });
    await open(page);
    const select = outer(page).locator('[part~="collection-grid"] select');
    await expect(select).toBeVisible();
    await select.evaluate(input => { input.value = 'unknown'; input.dispatchEvent(new Event('change', { bubbles: true })); });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('allowed enum');
    await select.selectOption('b');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['b']);
});

test('invalid virtualized numeric edit persists while detached and can be repaired', async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(() => { original = [Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`field${i}`, i]))]; grid.selectedObject.entries = original; });
    await open(page);
    const first = await valueInput(page, 'number');
    await first.fill('');
    await outer(page).locator('[part~="collection-grid"]').evaluate(g => { g._table.scrollTop = 3000; });
    await expect.poll(() => outer(page).locator('[part~="collection-grid"]').evaluate(g => !Array.from(g.shadowRoot.querySelectorAll('[part~="editor-number"]')).some(input => input.value === ''))).toBe(true);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(outer(page).getByRole('alert')).toContainText('finite number');
    expect((await result(page)).events).toBe(0);
    await outer(page).locator('[part~="collection-grid"]').evaluate(g => { g._table.scrollTop = 0; });
    await expect(await valueInput(page, 'number')).toHaveValue('');
    await (await valueInput(page, 'number')).fill('123');
    await outer(page).locator('[part~="collection-grid"]').evaluate(g => { g._table.scrollTop = 3000; });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value[0].field0).toBe(123);
});

for (const scenario of ['unknown', 'empty metadata', 'missing enum values', 'factory throw']) test(`draft editor creation ${scenario} is handled without page errors`, async ({ page }) => {
    await setup(page, { value: ['value'], item: scenario === 'unknown' ? { type: 'Unknown' } : scenario === 'missing enum values' ? { type: 'enum' } : {} });
    if (scenario === 'factory throw') await page.evaluate(async () => {
        const { PropertyGrid } = await import('/dist/PropertyGrid.js');
        const native = PropertyGrid.prototype.getEditorForType;
        PropertyGrid.prototype.getEditorForType = function (...args) { if (this !== grid) throw new Error('editor creation failed'); return native.apply(this, args); };
    });
    await open(page);
    if (scenario === 'empty metadata') {
        await (await valueInput(page)).fill('inferred');
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual(['inferred']);
    } else {
        await expect(outer(page).getByRole('alert')).not.toBeEmpty();
        await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
        await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    }
});

for (const reject of [false, true]) test(`async item schema ${reject ? 'reject' : 'unsupported'} gates every action and Cancel`, async ({ page }) => {
    await setup(page, { value: [{}], item: { type: 'Pending' } });
    await page.evaluate(() => { grid.getTypeInfo = (_obj, type) => type === 'Pending' ? new Promise((resolve, reject) => { window.finishSchema = resolve; window.rejectSchema = reject; }) : Promise.resolve(grid.typeDefinitions.find(info => info.name === type)); });
    await open(page);
    await expect.poll(() => page.evaluate(() => typeof finishSchema)).toBe('function');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await expect(outer(page).getByRole('listbox')).toBeDisabled();
    await expect(outer(page).getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    await page.evaluate(reject => reject ? rejectSchema(new Error('schema failed')) : finishSchema({ properties: [{ name: 'field', type: 'Unsupported' }] }), reject);
    await expect(outer(page).getByRole('alert')).not.toBeEmpty();
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    expect((await result(page)).events).toBe(0);
});

test('awaited native draft editor readiness cannot be bypassed by Apply', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const { PropertyGrid } = await import('/dist/PropertyGrid.js');
        const native = PropertyGrid.prototype.getEditorForType;
        PropertyGrid.prototype.getEditorForType = function (...args) { return this === grid ? native.apply(this, args) : new Promise(resolve => { window.finishEditor = async () => resolve(await native.apply(this, args)); }); };
    });
    await open(page);
    await expect.poll(() => page.evaluate(() => typeof finishEditor)).toBe('function');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await page.evaluate(() => finishEditor());
    await expect(await valueInput(page)).toHaveValue('one');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['one', 'two']);
});

test('private schemas are per value for repeated named sibling types', async ({ page }) => {
    await setup(page, { value: [{ left: { extra: { a: 'left' } }, right: { extra: { b: 'right' } } }], item: { type: 'Parent' }, definitions: [{ name: 'Parent', properties: [{ name: 'left', type: 'Child' }, { name: 'right', type: 'Child' }] }] });
    await page.evaluate(() => { grid.getTypeInfo = async (_obj, type) => type === 'Child' ? { properties: [{ name: 'extra', type: 'object' }] } : grid.typeDefinitions.find(info => info.name === type); });
    await open(page);
    await expect(outer(page).locator('[part~="editor-text"]')).toHaveCount(2);
    await expect(outer(page).locator('[part~="editor-text"]').nth(1)).toHaveValue('right');
    await outer(page).locator('[part~="editor-text"]').nth(1).fill('changed');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ left: { extra: { a: 'left' } }, right: { extra: { b: 'changed' } } }]);
});

test('schema defaults for every supported kind are cloned and escaped nested inline paths resolve', async ({ page }) => {
    await setup(page);
    const defaults = await page.evaluate(async () => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        const { createDefault } = await import('/dist/CollectionModel.js');
        const schemas = [
            { enum: ['a', 'b'], default: 'b' },
            { type: 'object', properties: { title: { type: 'string' } }, default: { title: 'object' } },
            { type: 'array', items: { type: 'number' }, default: [7] },
            { type: 'object', additionalProperties: { type: 'number' }, default: { key: 8 } },
            { $ref: '#/definitions/foo~1bar', default: { title: 'reference' } }
        ];
        const schema = { definitions: { Root: { properties: Object.fromEntries(schemas.map((items, i) => [`entry${i}`, { type: 'array', items }])) }, 'foo/bar': { properties: { title: { type: 'string' } } } } };
        const properties = typeInfoFromJsonSchema(schema, {}, 'Root').properties;
        const values = await Promise.all(properties.map(p => createDefault(p.collection.item, async (obj, type) => typeInfoFromJsonSchema(schema, obj, type))));
        values[1].title = 'changed'; values[2].push(9); values[3].key = 99; values[4].title = 'changed';
        const nested = { definitions: { 'a/b': { properties: { 'list/~': { type: 'array', items: { type: 'object', properties: { 'child/~': { type: 'object', properties: { title: { type: 'string', default: 'nested default' } } } } } } } } } };
        grid.typeName = 'a/b';
        grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(nested, obj, type);
        grid.selectedObject = { 'list/~': [] };
        return schemas.map(s => s.default);
    });
    expect(defaults).toEqual(['b', { title: 'object' }, [7], { key: 8 }, { title: 'reference' }]);
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(await valueInput(page)).toHaveValue('nested default');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => grid.selectedObject['list/~'])).toEqual([{ 'child/~': { title: 'nested default' } }]);
});

for (const fallback of [false, true]) test(`async collection hook ${fallback ? 'fallback' : 'control'} ignores same-owner reference replacement`, async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => { grid.getSpecialEditorForType = () => new Promise(resolve => window.finishHook = resolve); await grid.refresh(); });
    await expect.poll(() => page.evaluate(() => typeof finishHook)).toBe('function');
    await page.evaluate(fallback => { grid.selectedObject.entries = ['fresh']; const button = document.createElement('button'); button.textContent = 'Stale'; finishHook(fallback ? null : button); }, fallback);
    // Let the awaited render finish without requiring another refresh/version.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('#collections').getByRole('button', { name: 'Stale' })).toHaveCount(0);
    await expect(page.locator('#collections [part~="collection-edit"]')).toHaveCount(0);
    expect((await result(page)).value).toEqual(['fresh']);
});

test('Cancel releases controller session graphs and pending completion cannot revive them', async ({ page }) => {
    await setup(page, { value: [{ names: ['graph'] }], item: null });
    await page.evaluate(() => { window.controller = [...grid._collectionEditors][0]; });
    await open(page);
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => ['source', 'sourceObject', 'draft', 'draftGrid', 'draftObserver', 'dialog', 'list', 'key', 'content', 'error', 'nullToggle'].every(key => controller[key] === undefined) && controller.actions.length === 0 && controller.flushers.length === 0)).toBe(true);
    await page.evaluate(() => { grid.typeDefinitions[0].properties[0].collection = { item: { type: 'Pending' } }; grid.getTypeInfo = (_obj, type) => type === 'Pending' ? new Promise(resolve => window.finishDispose = resolve) : Promise.resolve(grid.typeDefinitions.find(info => info.name === type)); });
    await open(page);
    await expect.poll(() => page.evaluate(() => typeof finishDispose)).toBe('function');
    await page.keyboard.press('Escape');
    await page.evaluate(() => finishDispose({ properties: [] }));
    expect(await page.evaluate(() => controller.draft === undefined && controller.dialog === undefined && controller.content === undefined)).toBe(true);
    await page.evaluate(async () => { grid.getTypeInfo = async (_obj, type) => grid.typeDefinitions.find(info => info.name === type); await grid.refresh(); });
    expect(await page.evaluate(() => !grid._collectionEditors.has(controller))).toBe(true);
});

test('any editor creation preserves all primitive values and explicit type changes commit locally', async ({ page }) => {
    await setup(page, { value: ['text', 5, true, null], item: { type: 'any' } });
    await open(page);
    for (let index = 1; index < 4; index++) await outer(page).getByRole('listbox').selectOption({ index });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['text', 5, true, null]);
    await open(page);
    await outer(page).locator('[part~="any-type-selector"]').selectOption('number');
    await (await valueInput(page, 'number')).fill('12.5');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([12.5, 5, true, null]);
});

test('nullable named root can be enabled from null then disabled without expanding recursion', async ({ page }) => {
    await setup(page, { value: [null], item: { type: 'Node', nullable: true }, definitions: [{ name: 'Node', properties: [{ name: 'title', type: 'string', defaultValue: 'root' }, { name: 'child', type: 'Node', nullable: true }] }] });
    await open(page);
    await outer(page).getByLabel('Enable value', { exact: true }).check();
    await expect(await valueInput(page)).toHaveValue('root');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ title: 'root', child: null }]);
    await open(page);
    await outer(page).getByLabel('Enable value', { exact: true }).uncheck();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([null]);
});

test('nullable color toggles and edits preserve typed values', async ({ page }) => {
    await setup(page, { value: [null], item: { type: 'color', nullable: true } });
    await open(page);
    await outer(page).locator('[part~="nullable-toggle"]').check();
    await (await valueInput(page, 'color')).fill('#abcdef');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['#abcdef']);
});

test('async native editor rejection is visible and cancellation ignores late rejection', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const { PropertyGrid } = await import('/dist/PropertyGrid.js');
        const native = PropertyGrid.prototype.getEditorForType;
        PropertyGrid.prototype.getEditorForType = function (...args) { return this === grid ? native.apply(this, args) : new Promise((_resolve, reject) => { window.rejectEditor = reject; }); };
    });
    await open(page);
    await expect.poll(() => page.evaluate(() => typeof rejectEditor)).toBe('function');
    await page.evaluate(() => rejectEditor(new Error('async editor failed')));
    await expect(outer(page).getByRole('alert')).toContainText('async editor failed');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await open(page);
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => rejectEditor(new Error('late rejected editor')));
    expect((await result(page)).events).toBe(0);
});

test('escaped local definition refs create and edit named item defaults', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        const schema = { definitions: { Root: { properties: { entries: { type: 'array', items: { $ref: '#/definitions/foo~1bar~0baz' } } } }, 'foo/bar~baz': { properties: { title: { type: 'string', default: 'escaped' } } } } };
        grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
        grid.selectedObject = { entries: [] };
    });
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(await valueInput(page)).toHaveValue('escaped');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ title: 'escaped' }]);
});

test('collection referenced definitions retain inline child object defaults only in collection schema', async ({ page }) => {
    await setup(page);
    const ordinary = await page.evaluate(async () => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        const schema = { definitions: {
            Root: { properties: { entries: { type: 'array', items: { $ref: '#/definitions/Record' } } } },
            Record: { properties: { child: { type: 'object', properties: { title: { type: 'string', default: 'nested reference' } } } } },
            Ordinary: { properties: { child: { type: 'object', properties: { title: { type: 'string' } } } } }
        } };
        grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
        grid.selectedObject = { entries: [] };
        return typeInfoFromJsonSchema(schema, {}, 'Ordinary').properties[0].type;
    });
    expect(ordinary).toBe('object');
    await open(page);
    await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(await valueInput(page)).toHaveValue('nested reference');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ child: { title: 'nested reference' } }]);
});

test('virtualized field ownership discards a late editor from a recycled generation', async ({ page }) => {
    await setup(page, { item: null });
    await page.evaluate(async () => {
        const { PropertyGrid } = await import('/dist/PropertyGrid.js');
        const native = PropertyGrid.prototype.getEditorForType;
        window.pendingFieldEditors = [];
        PropertyGrid.prototype.getEditorForType = function (...args) {
            if (this !== grid && args[2] === 'value.field0') return new Promise(resolve => pendingFieldEditors.push(async () => resolve(await native.apply(this, args))));
            return native.apply(this, args);
        };
        original = [Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`field${i}`, i]))];
        grid.selectedObject.entries = original;
    });
    await open(page);
    await expect.poll(() => page.evaluate(() => pendingFieldEditors.length)).toBe(1);
    await outer(page).locator('[part~="collection-grid"]').evaluate(g => { g._table.scrollTop = 3000; });
    await expect.poll(() => outer(page).locator('[part~="editor-number"]').first().inputValue()).not.toBe('1');
    await outer(page).locator('[part~="collection-grid"]').evaluate(g => { g._table.scrollTop = 0; });
    await expect.poll(() => page.evaluate(() => pendingFieldEditors.length)).toBe(2);
    await page.evaluate(() => pendingFieldEditors[1]());
    await expect(await valueInput(page, 'number')).toHaveValue('0');
    await (await valueInput(page, 'number')).fill('77');
    await page.evaluate(() => pendingFieldEditors[0]());
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value[0].field0).toBe(77);
});

test('missing and unmatched named enum fields remain absent/unchanged until explicitly edited', async ({ page }) => {
    await setup(page, { value: [{ other: 'outside' }], item: { type: 'Record' }, definitions: [{ name: 'Record', properties: [
        { name: 'choice', type: 'enum', values: ['a', 'b'], defaultValue: 'b' },
        { name: 'other', type: 'enum', values: ['a', 'b'] }
    ] }] });
    await open(page);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ other: 'outside' }]);
    await open(page);
    await outer(page).locator('[part~="collection-grid"] select').first().selectOption('a');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ other: 'outside', choice: 'a' }]);
});

for (const type of ['array', 'dictionary']) test(`nested named ${type} resolves inherited Child metadata for editing and Add`, async ({ page }) => {
    const initial = type === 'array' ? [{ title: 'old' }] : { existing: { title: 'old' } };
    await setup(page, { value: [{ children: initial }], item: { type: 'Parent' }, definitions: [
        { name: 'Parent', properties: [{ name: 'children', type, collection: { item: { type: 'Child' } } }] },
        { name: 'Child', properties: [{ name: 'title', type: 'string', defaultValue: 'created' }] }
    ] });
    await page.evaluate(() => {
        grid.getTypeInfo = async function (_obj, type) {
            if (this !== grid) throw new Error('resolver lost parent binding');
            return this.typeDefinitions.find(info => info.name === type);
        };
        grid.getSpecialEditorForType = async () => { throw new Error('parent hook must not enter drafts'); };
    });
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    const nested = page.locator('#collections dialog[open]').last();
    await expect(nested.locator('[part~="editor-text"]')).toHaveValue('old');
    await nested.locator('[part~="editor-text"]').fill('edited');
    await nested.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(nested.locator('[part~="editor-text"]')).toHaveValue('created');
    await nested.locator('[part~="editor-text"]').fill('added');
    await nested.getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).events).toBe(0);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await result(page)).toEqual({ value: [{ children: type === 'array' ? [{ title: 'edited' }, { title: 'added' }] : { existing: { title: 'edited' }, key: { title: 'added' } } }], original: [{ children: initial }], events: 1 });
});

for (const type of ['array', 'dictionary']) test(`nested inline schema ${type} resolves private escaped item paths`, async ({ page }) => {
    await setup(page);
    await page.evaluate(async type => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        const item = { type: 'object', properties: { title: { type: 'string', default: 'inline created' } } };
        const children = type === 'array' ? { type: 'array', items: item } : { type: 'object', additionalProperties: item };
        const schema = { definitions: { Root: { properties: { entries: { type: 'array', items: { type: 'object', properties: { 'children/~': children } } } } } } };
        grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
        original = [{ 'children/~': type === 'array' ? [{ title: 'inline old' }] : { existing: { title: 'inline old' } } }];
        grid.selectedObject = { entries: original };
    }, type);
    await open(page);
    await outer(page).locator('[part~="collection-edit"]').click();
    const nested = page.locator('#collections dialog[open]').last();
    await expect(nested.locator('[part~="editor-text"]')).toHaveValue('inline old');
    await nested.locator('[part~="editor-text"]').fill('inline edited');
    await nested.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(nested.locator('[part~="editor-text"]')).toHaveValue('inline created');
    await nested.getByRole('button', { name: 'Apply', exact: true }).click();
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ 'children/~': type === 'array' ? [{ title: 'inline edited' }, { title: 'inline created' }] : { existing: { title: 'inline edited' }, key: { title: 'inline created' } } }]);
    expect((await result(page)).original).toEqual([{ 'children/~': type === 'array' ? [{ title: 'inline old' }] : { existing: { title: 'inline old' } } }]);
});

for (const nullableB of [false, true]) test(`nullable object detach preserves ${nullableB ? 'nullable' : 'nonnullable'} sibling alias`, async ({ page }) => {
    await setup(page, { item: { type: 'Parent' }, definitions: [
        { name: 'Parent', properties: [{ name: 'a', type: 'Child', nullable: true }, { name: 'b', type: 'Child', nullable: nullableB }] },
        { name: 'Child', properties: [{ name: 'title', type: 'string' }] }
    ] });
    await page.evaluate(() => { const shared = { title: 'shared' }; original = [{ a: shared, b: shared }]; grid.selectedObject.entries = original; });
    await open(page);
    await outer(page).getByLabel('Enable a', { exact: true }).uncheck();
    await expect(outer(page).locator('[part~="editor-text"]')).toHaveValue('shared');
    if (nullableB) await expect(outer(page).getByLabel('Enable b', { exact: true })).toBeChecked();
    await outer(page).locator('[part~="editor-text"]').fill('b edited');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([{ a: null, b: { title: 'b edited' } }]);
    expect(await page.evaluate(() => [original[0].a === original[0].b, original[0].a.title, grid.selectedObject.entries[0].b !== original[0].b, events.length])).toEqual([true, 'shared', true, 1]);
});

for (const [name, values] of [['numeric', [1, 2]], ['boolean', [false, true]]]) {
    for (const explicitDefault of [false, true]) test(`${name} schema enum Add/default/edit preserves primitive types (${explicitDefault ? 'explicit' : 'first'} default)`, async ({ page }) => {
        await setup(page);
        await page.evaluate(async ({ values, explicitDefault }) => {
            const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
            const items = { enum: values, ...(explicitDefault ? { default: values[1] } : {}) };
            const schema = { definitions: { Root: { properties: { entries: { type: 'array', items } } } } };
            grid.getTypeInfo = async (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
            grid.selectedObject = { entries: [] };
        }, { values, explicitDefault });
        await open(page);
        await outer(page).getByRole('button', { name: 'Add', exact: true }).click();
        const select = outer(page).locator('[part~="collection-grid"] select');
        await expect(select).toHaveValue(explicitDefault ? '1' : '0');
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([values[explicitDefault ? 1 : 0]]);
        await open(page);
        await expect(outer(page).locator('[part~="collection-grid"] select')).toHaveValue(explicitDefault ? '1' : '0');
        await outer(page).locator('[part~="collection-grid"] select').selectOption({ value: explicitDefault ? '0' : '1' });
        await expect.poll(() => page.evaluate(() => [...grid._collectionEditors][0].draft[0])).toBe(values[explicitDefault ? 0 : 1]);
        await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
        expect((await result(page)).value).toEqual([values[explicitDefault ? 0 : 1]]);
    });
}

test('mixed primitive enum choices disambiguate string/number collisions by index', async ({ page }) => {
    await setup(page, { value: [1], item: { type: 'enum', values: ['1', 1, false] } });
    await open(page);
    const select = outer(page).locator('[part~="collection-grid"] select');
    await expect(select).toHaveValue('1');
    await expect(select.locator('option')).toHaveText(['"1"', '1', 'false']);
    await select.selectOption({ value: '0' });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual(['1']);
    await open(page);
    await outer(page).locator('[part~="collection-grid"] select').selectOption({ value: '2' });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([false]);
});

for (const target of ['named item', 'dictionary', 'array extra']) test(`hidden nonenumerable ${target} is rejected without loss or events`, async ({ page }) => {
    await setup(page, { type: target === 'dictionary' ? 'dictionary' : 'array', item: target === 'named item' ? { type: 'Record' } : null, definitions: [{ name: 'Record', properties: [{ name: 'hidden', type: 'number' }] }] });
    await page.evaluate(target => {
        const record = target === 'array extra' ? ['visible'] : {};
        Object.defineProperty(record, 'hidden', { value: 7, enumerable: false, writable: false });
        original = target === 'named item' ? [record] : record;
        grid.selectedObject.entries = original;
    }, target);
    await open(page);
    await expect(outer(page).getByRole('alert')).toContainText('Nonenumerable');
    await expect(outer(page).getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
    expect(await page.evaluate(target => [grid.selectedObject.entries === original, (target === 'named item' ? original[0] : original).hidden, events.length], target)).toEqual([true, 7, 0]);
    await outer(page).getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('native array length and enumerable readonly data clone into editable isolated drafts', async ({ page }) => {
    await setup(page, { item: { type: 'Record' }, definitions: [{ name: 'Record', properties: [{ name: 'count', type: 'number' }] }] });
    await page.evaluate(() => { const record = {}; Object.defineProperty(record, 'count', { value: 3, enumerable: true, writable: false }); original = [record]; grid.selectedObject.entries = original; });
    await open(page);
    await (await valueInput(page, 'number')).fill('9');
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await page.evaluate(() => [grid.selectedObject.entries.length, grid.selectedObject.entries[0].count, original[0].count, Object.getOwnPropertyDescriptor(grid.selectedObject.entries[0], 'count').writable, events.length])).toEqual([1, 9, 3, true, 1]);
});

test('typed nullable enum preserves null and explicitly enables a boolean selection', async ({ page }) => {
    await setup(page, { value: [null], item: { type: 'enum', values: [false, true], nullable: true } });
    await open(page);
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([null]);
    await open(page);
    await outer(page).locator('[part~="nullable-toggle"]').check();
    await outer(page).locator('[part~="collection-grid"] select').selectOption({ value: '1' });
    await outer(page).getByRole('button', { name: 'Apply', exact: true }).click();
    expect((await result(page)).value).toEqual([true]);
});
