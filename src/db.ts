import Dexie, { Table } from 'dexie'

export interface UrlResult {
  id?: number
  url: string
  violations: any[]
  timestamp: Date
}

export class AppDatabase extends Dexie {
  urlResults!: Table<UrlResult>

  constructor() {
    super('AppDatabase')
    this.version(1).stores({
      urlResults: '++id, url, timestamp'
    })
  }
}

export const db = new AppDatabase()