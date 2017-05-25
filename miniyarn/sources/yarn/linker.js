import { BaseMultiLinker } from 'miniyarn/linkers/BaseMultiLinker';
import { RootLinker }      from 'miniyarn/linkers/RootLinker';
import { YarnLinker }      from 'miniyarn/linkers/YarnLinker';

export let linker = new BaseMultiLinker()

    .add(new YarnLinker())
    .add(new RootLinker())

;
