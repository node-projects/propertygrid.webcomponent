export interface ITypeDefinition {
    name: string
    properties: IPropertyDefinition[]
}

export interface IPropertyDefinition {
    name: string
    type: string | ITypeDefinition | 'color' | 'boolean' | 'number' | 'string' | 'list'
    description?: string
    nullable?: boolean
    possibleValues?: [value: string, description: string][]
    minimum?: number
    maximum?: number
}