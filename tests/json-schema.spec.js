import { test, expect } from '@playwright/test';

const schema = {
    definitions: {
        ExampleCommand: {
            type: 'object',
            properties: {
                type: { const: 'ExampleCommand', type: 'string' },
                mode: { $ref: '#/definitions/ExampleMode' }
            }
        },
        ExampleMode: { type: 'string', enum: ['first', 'second'] }
    }
};

for (const collection of [false, true]) {
    for (const present of [false, true]) {
        test(`referenced enum renders and edits with optional value ${present ? 'present' : 'absent'}${collection ? ' in a collection command type' : ''}`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('/tests/fixture.html');
            const property = await page.evaluate(async ({ schema, collection, present }) => {
                const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
                if (collection) {
                    schema.definitions.Script = {
                        properties: { commands: { type: 'array', items: { $ref: '#/definitions/ExampleCommand' } } }
                    };
                }
                const grid = document.createElement('node-projects-property-grid');
                grid.noCategory = true;
                grid.typeName = 'ExampleCommand';
                grid.getTypeInfo = (obj, type) => typeInfoFromJsonSchema(schema, obj, type);
                grid.selectedObject = present ? { type: 'ExampleCommand', mode: 'first' } : { type: 'ExampleCommand' };
                document.body.append(grid);
                await grid.refresh();
                return typeInfoFromJsonSchema(schema, grid.selectedObject, grid.typeName).properties[0];
            }, { schema, collection, present });
            expect(property).toMatchObject({ name: 'mode', type: 'enum', values: ['first', 'second'] });
            const select = page.locator('node-projects-property-grid select');
            await expect(select).toBeVisible();
            await expect(select.locator('option')).toHaveText(['first', 'second']);
            if (present) await expect(select).toHaveValue('first');
            else expect(await page.evaluate(() => document.querySelector('node-projects-property-grid').selectedObject)).toEqual({ type: 'ExampleCommand' });
            await select.selectOption('second');
            expect(await page.evaluate(() => document.querySelector('node-projects-property-grid').selectedObject.mode)).toBe('second');
            expect(errors).toEqual([]);
        });
    }
}

test('scalar definitions are not nested object types', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    const result = await page.evaluate(async schema => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        schema.definitions.Count = { type: 'number' };
        return ['ExampleMode', 'Count'].map(type => typeInfoFromJsonSchema(schema, null, type));
    }, schema);
    expect(result).toEqual([null, null]);
});

test('collection scalar references retain values while object references retain named types', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    const properties = await page.evaluate(async schema => {
        const { typeInfoFromJsonSchema } = await import('/dist/PropertyGrid.js');
        schema.definitions.Count = { type: 'number', default: 2 };
        schema.definitions.Root = { properties: {
            modes: { type: 'array', items: { $ref: '#/definitions/ExampleMode' } },
            counts: { type: 'array', items: { $ref: '#/definitions/Count' } },
            commands: { type: 'array', items: { $ref: '#/definitions/ExampleCommand' } }
        } };
        return typeInfoFromJsonSchema(schema, null, 'Root').properties;
    }, schema);
    expect(properties[0].collection.item).toMatchObject({ type: 'enum', values: ['first', 'second'] });
    expect(properties[1].collection.item).toMatchObject({ type: 'number', defaultValue: 2 });
    expect(properties[2].collection.item).toMatchObject({ type: 'ExampleCommand' });
});
