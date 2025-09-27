const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'


export const storage = {
    getAccess: () => localStorage.getItem(ACCESS_KEY),
    setAccess: (t: string | null) => {
        if (t) localStorage.setItem(ACCESS_KEY, t)
        else localStorage.removeItem(ACCESS_KEY)
    },
    getRefresh: () => localStorage.getItem(REFRESH_KEY),
    setRefresh: (t: string | null) => {
        if (t) localStorage.setItem(REFRESH_KEY, t)
        else localStorage.removeItem(REFRESH_KEY)
    },
    clear: () => {
        localStorage.removeItem(ACCESS_KEY)
        localStorage.removeItem(REFRESH_KEY)
    }
}