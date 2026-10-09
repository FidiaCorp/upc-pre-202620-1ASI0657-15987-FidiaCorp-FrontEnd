<script setup>
    import { storeToRefs } from 'pinia';
    import useRealStateStore from '../application/realState.store';
    import { onMounted } from 'vue';

    const realState = useRealStateStore();
    const {types, errors, typeLoaded} = storeToRefs(realState);
    const {fetchRealState} = realState;

    onMounted(() => {
        if (!typeLoaded.value) fetchRealState();
    });
</script>

<template>
    <div class="p-4">
        <h1>Inmobiliarios</h1>
        <pv-data-table
            :loading="!typeLoaded"
            :rows="5"
            :rows-per-page-options="[5,10,20]"
            :value="types";
            paginator
            striped-rows
            table-style="min-width: 50rem">
            <pv-column :header="types.id" field="id" sortable/>
            <pv-column :header="types.name" field="name" sortable/>
        </pv-data-table>
        <div v-if="errors.lenght" class="text-red-500 mt-3">
            Un error a sucedido: {{ errors.join(', ') }}
        </div>
    </div>
</template>