import { DataElementD2Repository } from "./data/repositories/DataElementD2Repository";
import { DataValueD2Repository } from "./data/repositories/DataValueD2Repository";
import { DataValueExportJsonRepository } from "./data/repositories/DataValueExportJsonRepository";
import { ExportDataElementJsonRepository } from "./data/repositories/ExportDataElementJsonRepository";
import { ImportDataElementSpreadSheetRepository } from "./data/repositories/ImportDataElementSpreadSheetRepository";
import { OrgUnitD2Repository } from "./data/repositories/OrgUnitD2Repository";
import { ImportDataElementsUseCase } from "./domain/usecases/ImportDataElementsUseCase";
import { Config } from "./models/Config";
import { D2Api } from "./types/d2-api";

export function getCompositionRoot(api: D2Api, config: Config) {
    const dataValueRepository = new DataValueD2Repository(api);
    const dataElementRepository = new DataElementD2Repository(api, config);
    const importDataElementSpreadSheetRepository = new ImportDataElementSpreadSheetRepository(
        api,
        config
    );
    const exportDataElementJsonRepository = new ExportDataElementJsonRepository(api, config);
    const dataValueExportRepository = new DataValueExportJsonRepository();
    const orgUnitRepository = new OrgUnitD2Repository(api);

    return {
        dataElements: {
            import: new ImportDataElementsUseCase(
                importDataElementSpreadSheetRepository,
                dataElementRepository,
                exportDataElementJsonRepository,
                dataValueRepository,
                dataValueExportRepository,
                orgUnitRepository
            ),
        },
    };
}

export type CompositionRoot = ReturnType<typeof getCompositionRoot>;
