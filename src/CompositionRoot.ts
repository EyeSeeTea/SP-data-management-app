import { DataElementD2Repository } from "./data/repositories/DataElementD2Repository";
import { ExportDataElementJsonRepository } from "./data/repositories/ExportDataElementJsonRepository";
import { ImportDataElementSpreadSheetRepository } from "./data/repositories/ImportDataElementSpreadSheetRepository";
import { ImportDataElementsUseCase } from "./domain/usecases/ImportDataElementsUseCase";
import { Config } from "./models/Config";
import { D2Api } from "./types/d2-api";

export function getCompositionRoot(api: D2Api, config: Config) {
    const dataElementRepository = new DataElementD2Repository(api, config);
    const importDataElementSpreadSheetRepository = new ImportDataElementSpreadSheetRepository(
        api,
        config
    );
    const exportDataElementJsonRepository = new ExportDataElementJsonRepository(api, config);

    return {
        dataElements: {
            import: new ImportDataElementsUseCase(
                importDataElementSpreadSheetRepository,
                dataElementRepository,
                exportDataElementJsonRepository
            ),
        },
    };
}

export type CompositionRoot = ReturnType<typeof getCompositionRoot>;
