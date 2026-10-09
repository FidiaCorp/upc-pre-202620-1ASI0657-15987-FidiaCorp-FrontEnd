<script>
    const routes = [
        {label: 'Inicio', to :'/home'},
        {label: 'Inmobiliario', to: '/realState'},
        {label: 'Mensajeria', to: '/messaging'},
        {label: 'Mis productos', to: '/products'},
        {label: 'Perfil', to: '/profile'}
    ]
</script>

<template>
    <pv-cofirm-dialog/>
    <div>
        <header class="absolute">
            <pv-toolbar class="">
                <template #start>
                    <h3>FidiaCorp</h3>
                </template>
                <template #end>
                    <div class="flex-column mr-3">
                        <pv-button v-for="route in routes" :key="route.label" as-child v-slot="slotProps">
                            <router-link :to="route.to" :class="slotProps['class']">{{ route.label }}</router-link>
                        </pv-button>
                    </div>
                </template>
            </pv-toolbar>
        </header>
        <main>
            <router-view/>
        </main>
    </div>
</template>