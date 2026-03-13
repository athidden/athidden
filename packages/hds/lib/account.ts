// TODO: implement account allowlist logic

// TODO: implement account store/retrieve logic

// NOTE: basically, to avoid extra code and extra SQLite databases, we do a
// cool hack. the account system stores it's data like any other hidden data,
// just in the did:web:HDS_HOSTNAME repo. anyway check out the hds.account and
// hds.accountAllowlist.item lexicons for the structure of this data. the
// allowlist is used whenever someone tries to create a repo for the first
// time. we check the hds.account list whenever someone tries to write
// something to confirm they have an account and they arent banned - and if
// they dont have one we obviously check the allowlist. yadda yadda
