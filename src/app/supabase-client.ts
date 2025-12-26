import {createClient} from "@supabase/supabase-js"

// they need url and anonyms or secret key so we use it here below in createclient
export const supabase = createClient("do your supabase keys secret, and partial both here insted of env file ")
