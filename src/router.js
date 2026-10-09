import { createRouter, createWebHistory } from "vue-router";
import Home from './shared/presentation/views/home.vue'
import TypeList from "./realState/views/type-list.vue";

const routes = [
    {path: '/home', name: 'home', component: Home, meta: {title: 'Home'} },
    {path: '/realState', name: 'realState', component: TypeList, meta: {title: 'RealState'}}
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: routes
});

export default router;