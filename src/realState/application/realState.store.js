import { defineStore } from "pinia";
import { shallowRef } from "vue";
import { RealStateApi } from "../infrastructure/realState-api"
import { typeAssembler } from "../infrastructure/type.assembler";

const realStateApi = new RealStateApi();

const useRealStateStore = defineStore('realState', () => {
    const type = shallowRef([]);
    const errors = ref([]);
    const typeLoaded = ref(false);

    function fetchRealState() {
        realStateApi.getTypes.then(response => {
            type.value = typeAssembler.toEntityFromResponse(response);
            typeLoaded.value = true
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    function getTypesById(id) {
        const idNum = parseInt(id);
        return type.value.find(type => type.id === idNum);
    }

    return {
        type,
        errors,
        typeLoaded,
        fetchRealState,
        getTypesById
    }
});

export default useRealStateStore;
