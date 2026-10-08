import { createRouter, createWebHistory } from "vue-router";
import Home from './shared/presentation/views/home.vue'

const routes = [
    {path: '/home', name: 'home', component: Home, meta: {title: 'Home'} }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: routes
});

export default router;