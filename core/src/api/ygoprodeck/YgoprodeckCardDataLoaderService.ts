import { mapCard, RawCard } from "./mapping/mapCard";
import { mapCardSet, RawCardSet } from "./mapping/mapCardSet";
import { CardSet } from "../../core/model/ygo/CardSet";
import { CardDataLoaderService } from "../../core/business/service/CardDataLoaderService";
import { PaginatedResponse } from "./PaginatedResponse";
import { inject, injectable } from "inversify";
import { mapCardValues, RawCardValues } from "./mapping/mapCardValues";
import { CardValues } from "../../core/model/ygo/CardValues";
import { UnlinkedCard } from "../../core/model/ygo/intermediate/UnlinkedCard";
import { TYPES } from "../../types";
import {
    HttpRequestConfig,
    HttpService,
} from "../../core/business/service/HttpService";
import { mapArchetype, RawArchetype } from "./mapping/mapArchetype";
import { Format } from "../../core/model/ygo/Format";
import { DEVELOPMENT_MODE } from "../../mode";
import { merge } from "lodash";

/**
 * {@link CardDataLoaderService} implementation using the YGOPRODECK API (https://db.ygoprodeck.com/api-guide/).
 */
@injectable()
class YgoprodeckCardDataLoaderService implements CardDataLoaderService {
    private static readonly CARD_INFO_CHUNK_SIZE = 2000;
    private static readonly API_BASE_URL = DEVELOPMENT_MODE
        ? "https://db.ygoprodeck.com/api/v7/"
        : "https://ygoprodeck.com/api/deck-builder/";
    private readonly httpService: HttpService;

    constructor(
        @inject(TYPES.HttpService)
        httpService: HttpService
    ) {
        this.httpService = httpService;
    }

    public async getCardByName(name: string): Promise<UnlinkedCard | null> {
        const response = await this.httpService.get<{ data: RawCard[] }>(
            "cardinfo.php",
            merge(this.createBaseRequestConfig(), {
                params: {
                    misc: "yes",
                    name: name,
                },
                validateStatus: (status: number) =>
                    status === 200 || status === 400, // Special 400 handling, we expect this if a card is not found
            })
        );
        if (response.status === 400) {
            return null;
        }
        const responseData = response.data;
        // If a match is found, a single element array is returned.
        return mapCard(responseData.data[0]);
    }

    public async getAllCards(): Promise<UnlinkedCard[]> {
        const responseData = await this.loadPaginated<RawCard>(
            YgoprodeckCardDataLoaderService.CARD_INFO_CHUNK_SIZE,
            async (offset) => {
                const response = await this.httpService.get<
                    PaginatedResponse<RawCard[]>
                >(
                    "cardinfo.php",
                    merge(this.createBaseRequestConfig(), {
                        params: {
                            misc: "yes",
                            includeAliased: "yes",
                            num:
                                YgoprodeckCardDataLoaderService.CARD_INFO_CHUNK_SIZE,
                            offset,
                        },
                    })
                );
                return response.data;
            }
        );
        // Rush Duel is excluded by default, load it separately.
        const secondaryResponse = await this.httpService.get<
            PaginatedResponse<RawCard[]>
        >(
            "cardinfo.php",
            merge(this.createBaseRequestConfig(), {
                params: {
                    misc: "yes",
                    includeAliased: "yes",
                    format: Format.RUSH_DUEL,
                },
            })
        );
        responseData.push(...secondaryResponse.data.data);

        return responseData.map(mapCard);
    }

    public async getAllCardSets(): Promise<CardSet[]> {
        const response = await this.httpService.get<RawCardSet[]>(
            "cardsets.php",

            this.createBaseRequestConfig()
        );
        return response.data.map(mapCardSet);
    }

    public async getCardValues(): Promise<CardValues> {
        const response = await this.httpService.get<RawCardValues>(
            "cardvalues.php",
            this.createBaseRequestConfig()
        );
        return mapCardValues(response.data);
    }

    public async getArchetypes(): Promise<string[]> {
        const response = await this.httpService.get<RawArchetype[]>(
            "archetypes.php",
            this.createBaseRequestConfig()
        );
        return response.data.map(mapArchetype);
    }

    private createBaseRequestConfig(): HttpRequestConfig {
        return {
            baseURL: YgoprodeckCardDataLoaderService.API_BASE_URL,
            timeout: 10000,
            responseType: "json",
        };
    }

    private async loadPaginated<T>(
        pageSize: number,
        fetcher: (offset: number) => Promise<PaginatedResponse<T[]>>
    ): Promise<T[]> {
        const result: T[] = [];
        let offset = 0;
        let total: number | null = null;

        while (total == null || result.length < total) {
            const response = await fetcher(offset);
            result.push(...response.data);
            if (total == null) {
                total = response.meta.total_rows;
            }
            offset += pageSize;
        }

        return result;
    }
}

export { YgoprodeckCardDataLoaderService };