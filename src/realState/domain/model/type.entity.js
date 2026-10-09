export class Type {
    #id;
    #name;
    #flagged;

    constructor({id = null, name = '', flagged = false}) {
        this.#id = id;
        this.#name = name;
        this.#flagged = flagged;
    }

    get id() {
        return this.#id;
    }

    get name() {
        return this.#name;
    }

    get flagged() {
        return this.#flagged;
    }
}