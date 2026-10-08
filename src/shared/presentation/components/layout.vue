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
    <div>
        <header class="absolute">
            <pv-toolbar class="">
                <template #start>
                    <h3>FidiaCorp</h3>
                </template>
                <template #end>
                    <div class="flex-column mr-3">
                        <pv-button>

                        </pv-button>
                    </div>
                </template>
            </pv-toolbar>
        </header>
    </div>
</template>