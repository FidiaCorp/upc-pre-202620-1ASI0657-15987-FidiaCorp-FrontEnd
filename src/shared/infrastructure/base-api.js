import axios from "axios"

const Api = import.meta.env.FIDIACORP_PLATFORM_API_URL;

export class BaseApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: Api,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    get http() {
        return this.#http;
    }
}