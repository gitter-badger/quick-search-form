import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import moment from 'moment';
import Decimal from 'decimal.js';
export { qBase, queryJSON2Mongo } from './utils.js';
import { validate, form2JSON, JSON2form } from './utils.js'; 
import clone from 'clone';
import { ReactiveDict } from 'meteor/reactive-dict';

export const integer = (i) => {i.inputmask('Regex', { 
    regex: "^[+-]?\\d+$"
    });
}

export const float = (i) => {i.inputmask('Regex', { 
    regex: "^[+-]?((\\.\\d+)|(\\d+(\\.\\d+)?))$"
    });
}

export const date = (i) => {i.datepicker({
  format: 'dd/mm/yyyy'
})}

const validateWithErrors = (obj, schema, errors, att=null) => {  
  const valids = validate(obj, schema, att);

  if(att){
    errors.set(att, '');
  }else{
    for(let k of Object.keys(schema)){
      errors.set(k, '');
    }
  }

  if(_.every(_.values(valids))){          
    return true;
  }else{
    for(let k of Object.keys(valids)){
      if(!valids[k]){
        if(schema[k])
          errors.set(k, schema[k].message); 
      }
    }
  }  
}

const getDoc = (rd, schema) => {
  const ret = {};
  for(let k of Object.keys(schema)){
    ret[k] = rd.get(k);
  }
  return ret;
}

const setDoc = (rd, doc, schema) => {
  for(let k of Object.keys(schema)){
    const v = doc[k] || '';
    rd.set(k, v);
  }
}

const setDocAttr = (rd, name, value, schema) => {
    let type = schema[name].type;
    switch(type){
      case 'integer':
      case 'float':
      case 'decimal':
        if(value == ''){
          value = undefined;
        }else{
          value = +value || 0;
        }
        break;
      case 'string':
      case 'boolean':
      case 'array':        
        break; 
      case 'date':
        const m = moment(value, 'DD/MM/YYYY');
        if(!m.isValid()){
            value = undefined;
        }else{
            value = m.toDate();
        }
        break;  
    }
    rd.set(name, value);
}

export const qForm = (template, {schema, integer, float, date, autocomplete, callback}) => {

  template.onCreated(function(){
    let self = this;
    self.doc = new ReactiveDict();
    self.errors = new ReactiveDict();
    //self.dirty = false;

    this.autorun(function(){
      let doc = Session.get(self.data.input) || self.data.initial || {};
      //if(self.dirty && dirtyCallback)
      validateWithErrors(doc, schema, self.errors);
      doc = clone(doc, false);
      doc = JSON2form(doc, schema);
      setDoc(self.doc, doc, schema); 
      self.dirty = false;
    });
  });

  template.onRendered(function(){
    if(integer) integer(this.$('.integer'));
    if(float){
      float(this.$('.float'));
      float(this.$('.decimal'));
    }
    if(date) date(this.$('.date'));
    if(autocomplete) autocomplete(this.$('.autocomplete'));
    //const doc = getDoc(this.doc, schema);
    
    //for(let att of Object.keys(doc)){
    //  this.$("input[name='" + att + "']").val(doc[att]);
    //}    
  });

  template.events({
    'keyup input'(evt, tmpl){
      const name = evt.currentTarget.name;
      //const value = $(evt.currentTarget).val();
      const value = evt.currentTarget.value;
      tmpl.doc.set(name, value);
      let doc = getDoc(tmpl.doc, schema);
      let obj = form2JSON(doc, schema);         
      validateWithErrors(obj, schema, tmpl.errors, name);
      tmpl.dirty = true;
    },
    'change input, change textarea, change select'(evt, tmpl){
      const name = evt.currentTarget.name;
      const value = evt.currentTarget.type === "checkbox" ? evt.currentTarget.checked : evt.currentTarget.value;
      const oldValue = tmpl.doc.get(name);
      if(value != oldValue){
        tmpl.dirty = true;
        tmpl.doc.set(name, value);
        let doc = getDoc(tmpl.doc, schema);
        let obj = form2JSON(doc, schema);         
        validateWithErrors(obj, schema, tmpl.errors, name);
      }
    },
    'click .reset'(evt, tmpl){
      Session.set(tmpl.data.input, {});
      Session.set(tmpl.data.input, null);
    },
    'click .submit': function (e, tmpl) {//TODO: don't use name obj, use name doc
        let doc = getDoc(tmpl.doc, schema);
        let obj = form2JSON(doc, schema);   
        if(validateWithErrors(obj, schema, tmpl.errors)){
          obj = clone(obj, false);
          Session.set(tmpl.data.output, obj);
          Session.set(tmpl.data.input, {});
          Session.set(tmpl.data.input, null);
          if(callback){
            callback(tmpl.data.input, obj);
          }            
        }
      }
  });  

  template.helpers({
    setattr(attribute){
      return ()=>(value)=>{
        doc.set(attribute, value);
      }
    },
    add(attribute){
      let tmpl = Template.instance();
      return ()=>(value)=>{
        const doc = tmpl.doc;
        let arr = doc.get(attribute);
        if(!_.contains(arr, value)){
          arr.push(value);
          doc.set(attribute, arr);
        }
      }
    },
    remove(attribute){
      let tmpl = Template.instance();
      return ()=>(value)=>{
        const doc = tmpl.doc;
        let arr = doc.get(attribute);
        if(_.contains(arr, value)){
          arr = _.filter(arr, (x)=>x!=value);
          doc.set(attribute, arr);
        }
      }
    },
    doc(attribute){
      const doc = Template.instance().doc;
      return doc.get(attribute);
    },
    errorMessage(attribute){
      const errors = Template.instance().errors;
      return errors.get(attribute);
    },
    isValid(){
      const errors = Template.instance().errors;

      for(let k of Object.keys(schema)){
        if(errors.get(k) != ''){
          return false;
        }
      }
      return true;
    }
  });
}
