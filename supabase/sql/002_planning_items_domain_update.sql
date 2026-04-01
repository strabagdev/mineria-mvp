alter table planning_items
  rename column subtype to item_type;

alter table planning_items
  rename column title to description;
