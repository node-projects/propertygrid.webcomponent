import { BaseCustomWebComponentConstructorAppend, css, DomHelper, html } from "@node-projects/base-custom-webcomponent";
import { IPropertyDefinition, ITypeDefinition } from "./Interfaces";

export class PropertygridWebcomponent extends BaseCustomWebComponentConstructorAppend {

    public static override readonly style = css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
            font-family: sans-serif;
        }

        #tableDiv {
            height: 100%;
            display: grid;
            overflow: auto;
            grid-template-rows: auto 1fr auto auto;
            grid-template-areas:
                'head'
                'properties'
                '.'
                'description';
        }

        .input-group {
            display: flex;
            align-items: center;
        }

        .form-control {
            width: 100%;
            box-sizing: border-box;
            min-height: unset;
            height: 21px;
        }

        #clear {
            height: 11px;
        }

        #head {
            border-bottom: 1px lightgray solid;
            grid-area: head;
            font-size: 10pt;
            overflow: hidden;
        }

        thead th,
        #head {
            position: sticky;
            top: 0;
            left: 1px;
            background: #f0f0f0;
            padding-left: 5px;
        }

        #tableDiv {
            overflow: auto;
            width: 100%;
            height: 100%;
            grid-area: properties;
        }

        table {
            user-select: none;
            overflow: auto;
            width: calc(100% - 1px);
            table-layout: fixed;
        }

        table td {
            overflow: hidden;
        }

        table td:nth-child(2) {
            overflow: visible;
        }

        table th {
            overflow: visible;
        }

        table th.resizing {
            cursor: col-resize;
        }

        tr.fancytree-folder {
            background-color: #e6e6e6;
        }

        #lastCol {
            width: 100%;
        }

        #description {
            font-family: tahoma, arial, helvetica;
            font-size: 10pt;
            padding: 5px;
            grid-area: description;
            background-color: #e6e6e6;
        }

        #descText {
            white-space: break-spaces;
        }`;

    public static override readonly template = html` 
        <div id="tableDiv">
            <div id="head"></div>
            <div id="tableDiv">
                <table id="table">
                    <colgroup>
                        <col style="width: 35%;" />
                        <col id="lastCol" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody id="tbody"></tbody>
                </table>
            </div>

            <div id="description">
                <h4 id="descTitel"></h4>
                <p id="descText"></p>
            </div>
        </div>`;

    public static readonly is = 'node-projects-propertygrid';

    public static properties = {
        typeDefinitions: Object
    }

    private _typeDefinitions: Record<string, ITypeDefinition>
    public get typeDefinitions() { return this._typeDefinitions; }
    public set typeDefinitions(value: Record<string, ITypeDefinition>) { this._typeDefinitions = value; }

    private _tbody: HTMLTableSectionElement;

    constructor() {
        super();
        this._restoreCachedInititalValues();
        this._tbody = this._getDomElement<HTMLTableSectionElement>('tbody');
    }

    ready() {
        this._parseAttributesToProperties();
    }

    setSelectedObject(value: any, typeName: string) {
        DomHelper.removeAllChildnodes(this._tbody);
        this.createEditors(typeName, value);
    }

    createEditors(typeName: string, value: any) {
        const type = this._typeDefinitions[typeName];
        for (let p of type.properties) {
            this.createEditor(p, value?.[p.name]);
        }
    }

    createEditor(propertyDefinition: IPropertyDefinition, value: any) {
        const row = document.createElement('tr');
        const col1 = document.createElement('td');
        row.appendChild(col1);
        col1.innerText = propertyDefinition.name;

        let editor: HTMLElement;
        switch (propertyDefinition.type) {
            case 'boolean':
                editor = this.createBooleanEditor(propertyDefinition, value);
                break;
            case 'number':
                editor = this.createNumberEditor(propertyDefinition, value);
                break;
            case 'string':
                editor = this.createStringEditor(propertyDefinition, value);
                break;
            case 'color':
                editor = this.createColorEditor(propertyDefinition, value);
                break;
            case 'datetime':
                //editor = this.createColorEditor(propertyDefinition, value);
                break;
            default:
                //editor = this.createColorEditor(propertyDefinition, value);
                break;
        }

        if (propertyDefinition.nullable) {
            editor = this.createNullableWrapper(editor, propertyDefinition, value);
        }

        const col2 = document.createElement('td');
        row.appendChild(col2);
        col2.appendChild(editor);

        this._tbody.appendChild(row);
    }

    createBooleanEditor(propertyDefinition: IPropertyDefinition, value: any) {
        const boolEditor = document.createElement('input');
        boolEditor.type = "checkbox";
        boolEditor.checked = value == true;
        return boolEditor;
    }

    createNumberEditor(propertyDefinition: IPropertyDefinition, value: any) {
        const numberEditor = document.createElement('input');
        numberEditor.type = "number";
        numberEditor.value = value;
        if (propertyDefinition.minimum)
            numberEditor.min = propertyDefinition.minimum.toString();
        if (propertyDefinition.maximum)
            numberEditor.max = propertyDefinition.maximum.toString();
        return numberEditor;
    }

    createStringEditor(propertyDefinition: IPropertyDefinition, value: any) {
        const stringEditor = document.createElement('input');
        stringEditor.type = "text";
        stringEditor.value = value;
        return stringEditor;
    }

    createColorEditor(propertyDefinition: IPropertyDefinition, value: any) {
        const colorEditor = document.createElement('input');
        colorEditor.type = "color";
        colorEditor.value = value;
        return colorEditor;
    }

    createNullableWrapper(editor: HTMLElement, propertyDefinition: IPropertyDefinition, value: any) {
        const nullableEditor = document.createElement('input');
        nullableEditor.type = "checkbox";
        nullableEditor.checked = value != null;
        return nullableEditor;
    }
}

customElements.define(PropertygridWebcomponent.is, PropertygridWebcomponent);
declare global {
    interface HTMLElementTagNameMap {
        'node-projects-propertygrid': PropertygridWebcomponent;
    }
}