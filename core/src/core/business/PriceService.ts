import { injectable } from "inversify";
import { Card } from "../model/Card";
import { CardPrices } from "../model/CardPrices";

interface PriceLookupResult {
    prices: CardPrices;
    missing: Card[];
}

@injectable()
class PriceService {
    public hasPrice(card: Card): boolean {
        return card.prices != null;
    }

    public getPrice(...cards: Card[]): PriceLookupResult {
        const missing: Card[] = cards.filter(card => !this.hasPrice(card));
        const prices: CardPrices = cards
            .filter(card => this.hasPrice(card))
            .map(card => card.prices)
            .reduce((previousValue, currentValue) => {
                return this.createPrices(
                    previousValue!.cardmarket + currentValue!.cardmarket,
                    previousValue!.tcgplayer + currentValue!.tcgplayer,
                    previousValue!.ebay + currentValue!.ebay,
                    previousValue!.amazon + currentValue!.amazon,
                    previousValue!.coolstuffinc + currentValue!.coolstuffinc
                );
            }, this.createPrices(0, 0, 0, 0, 0))!;
        return { prices, missing };
    }

    private createPrices(
        cardmarket: number,
        tcgplayer: number,
        ebay: number,
        amazon: number,
        coolstuffinc: number
    ): CardPrices {
        return {
            cardmarket: cardmarket,
            tcgplayer: tcgplayer,
            ebay: ebay,
            amazon: amazon,
            coolstuffinc: coolstuffinc
        };
    }
}

export { PriceService };