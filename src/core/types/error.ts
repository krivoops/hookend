interface Error {
    title?: string;
    detail?: string;
    code?: string;
    status: number;
    success: boolean;
}

export {
    Error,
};
