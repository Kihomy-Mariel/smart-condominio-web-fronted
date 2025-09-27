export interface AdminUser {
id: number
usuario: string
nombres?: string
apellido?: string
carnet?: string
telefono?: string
direccion?: string
email?: string
}


export interface LoginResponse {
access: string
refresh: string
// Campos extra devueltos por tu CustomTokenObtainPairSerializer
id: number
nombres?: string
apellido?: string
carnet?: string
telefono?: string
direccion?: string
usuario: string
email?: string
}