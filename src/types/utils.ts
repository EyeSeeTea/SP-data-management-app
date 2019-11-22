/*
Extract properties from an object of a certain type:

    type Person = {name: string, age: number, address: string},
    type StringFields = GetPropertiesByType<Person, string>
    // "name" | "address"

*/
export type GetPropertiesByType<T, FieldType> = {
    [Key in keyof T]: T[Key] extends FieldType ? Key : never;
}[keyof T];

/* Get inner type of array */
export type GetItemType<T> = T extends (infer U)[] ? U : never;
