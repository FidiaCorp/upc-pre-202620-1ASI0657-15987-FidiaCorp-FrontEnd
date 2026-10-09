import { BaseApi } from "../../shared/infrastructure/base-api";
import { BaseEndpoint } from "../../shared/infrastructure/base-endpoint"

export class RealStateApi extends BaseApi {
    #realStateEndpoint;

    constructor() {
        super();
        this.#realStateEndpoint = new BaseEndpoint(this, realStateEndpoint);
    }

    getTypes() {
        return this.#realStateEndpoint.getAll();
    }

    getTypesById(id) {
        return this.#realStateEndpoint.getById();
    }

    createType(resource) {
        return this.#realStateEndpoint.create(resource);
    }

    updateType(resource) {
        return this.#realStateEndpoint.update(resource);
    }

    deleteType(id) {
        return this.#realStateEndpoint.delete(id);
    }
}