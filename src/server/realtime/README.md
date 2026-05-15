# Realtime

This layer will document and isolate realtime contracts. Supabase Realtime remains the current provider and existing subscriptions should not be moved or changed during the preparatory phase.

Future modules can define channel names, event contracts, and adapter boundaries so UI code is not permanently coupled to Supabase Realtime APIs.

If realtime delivery changes later, this boundary can support another implementation while keeping the rest of the application behavior stable.

