import { Module } from "@nestjs/common";

import { PriceScraperService } from "./price-scraper.service";

@Module({
  providers: [PriceScraperService],
  exports: [PriceScraperService]
})
export class PriceScraperModule {}
