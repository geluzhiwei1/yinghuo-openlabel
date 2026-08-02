export interface JobStatusEntry {
    status: string;
    update_time?: string;
    user_id?: string;
    desc?: string;
}

export interface JobPerform {
    uuid: string;
    id: number;
    name: string;
    desc: string;
    main_user_id?: string;
    data_seq: string;
    domain: string;
    mission: string;
    taxonomy: string;
    data_format: string;
    data: object;
    anno_hrefs: Array<{ stream: string; uri: string }>;
    authority?: { owners: string[] };
    current_status?: JobStatusEntry;
    status_history?: JobStatusEntry[];
    disableDeleteBtn?: boolean;
}
