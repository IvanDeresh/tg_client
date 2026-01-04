import path from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";

export const paths = {
    session: path.join(DATA_DIR, "session.txt"),
    config: path.join(DATA_DIR, "config.json"),
    contacted: path.join(DATA_DIR, "contacted.json"),
};
