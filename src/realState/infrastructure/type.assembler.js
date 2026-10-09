import { Type } from "../domain/model/type.entity";

export class typeAssembler {
    static toEntityFromResource(resource){
        return new Type({...resource});
    }

    static toResourceFromEntity(entity){
        return {id: entity.id, name: entity.name};
    }

    static toEntityFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }
        let resources = response.data instanceof Array ? response.data : response.data['categories'];
        
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}