import type { TFile } from "obsidian";

export interface Image {
  path: string;
  name: string;
  source: string;
  file?: TFile | null;
}

export interface PicListImage {
  imgUrl: string;
  [key: string]: unknown;
}
